const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');

// Your Cloudflare Worker URL
const WORKER_URL = 'https://zoho-webhook-worker.med217623.workers.dev/';

const tokenCache = {};

const getAccount = async (id) => {
    try {
        const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
        const accounts = JSON.parse(data);
        return accounts.find(acc => acc.id === id);
    } catch (error) {
        return null;
    }
};

const getNewAccessToken = async (clientId, clientSecret, refreshToken) => {
    const params = new URLSearchParams();
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
    });
    return response.data;
};

const getZohoAccessToken = async (accountId, clientId, clientSecret, refreshToken) => {
    const currentTime = Date.now();
    const cachedToken = tokenCache[accountId];
    
    if (!cachedToken || currentTime >= cachedToken.expires_at) {
        const data = await getNewAccessToken(clientId, clientSecret, refreshToken);
        if (!data.access_token) throw new Error("Failed to retrieve access token from Zoho");
        tokenCache[accountId] = { access_token: data.access_token, expires_at: currentTime + (data.expires_in * 1000) - 60000 };
    }
    return tokenCache[accountId].access_token;
};

// --- SMART BOUNCE ANALYZER ---
const analyzeBounceReason = (summary, defaultEvent) => {
    if (!summary) return defaultEvent === 'newMail' ? 'Bounce' : (defaultEvent || 'Unknown');
    const text = summary.toLowerCase();

    // 1. Check for Spam/Blocklists first
    if (text.includes('spam') || text.includes('blocked') || text.includes('blacklisted') || text.includes('policy violation') || text.includes('reputation')) {
        return 'Spam';
    }
    
    // 2. Check for Hard Bounces (Permanent Failures / 5xx Codes)
    // 550, 551, 552, 553, 554, 5.1.1, 5.7.1, etc.
    if (
        /5[0-5][0-9]/.test(summary) || 
        /5\.\d\.\d/.test(summary) ||
        text.includes('permanent') ||
        text.includes('not exist') ||
        text.includes('user unknown') ||
        text.includes('rejected') ||
        text.includes('invalid address')
    ) {
        return 'Hard Bounce';
    }

    // 3. Check for Soft Bounces (Temporary Failures / 4xx Codes)
    // 421, 450, 451, 452, 4.2.2, 4.4.1, etc.
    if (
        /4[0-5][0-9]/.test(summary) || 
        /4\.\d\.\d/.test(summary) ||
        text.includes('temporary') ||
        text.includes('full') ||
        text.includes('quota') ||
        text.includes('timeout') ||
        text.includes('try again')
    ) {
        return 'Soft Bounce';
    }

    return defaultEvent === 'newMail' ? 'Bounce' : (defaultEvent || 'Unknown');
};

router.post('/check-status', async (req, res) => {
    const { apiKey, apiUrl, defaultEvent } = req.body; 
    if (!apiKey || !apiUrl || !defaultEvent) return res.status(400).json({ message: 'Missing OAuth credentials' });
    try {
        const data = await getNewAccessToken(apiKey, apiUrl, defaultEvent);
        if (data.access_token) res.json({ status: 'connected', response: "OAuth Authentication Successful" });
        else res.status(401).json({ status: 'failed', response: data });
    } catch (error) {
        res.status(401).json({ status: 'failed', response: error.response?.data || error.message });
    }
});

router.get('/sub-accounts', async (req, res) => {
    const { accountId } = req.query;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const accessToken = await getZohoAccessToken(accountId, account.apiKey, account.apiUrl, account.defaultEvent);
        const response = await axios.get(`https://mail360.zoho.com/api/accounts`, { 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Zoho-oauthtoken ${accessToken}` } 
        });
        
        const accountsArray = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
        res.json({ success: true, data: accountsArray });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch sub-accounts", details: error.response?.data || error.message });
    }
});

router.post('/send-email', async (req, res) => {
    const { accountId, to, subject, content, from, fromName } = req.body;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const accessToken = await getZohoAccessToken(accountId, account.apiKey, account.apiUrl, account.defaultEvent);
        const subAccountsResponse = await axios.get(`https://mail360.zoho.com/api/accounts`, { 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Zoho-oauthtoken ${accessToken}` } 
        });
        
        const accountsArray = Array.isArray(subAccountsResponse.data?.data) ? subAccountsResponse.data.data : Array.isArray(subAccountsResponse.data) ? subAccountsResponse.data : [];
        const subAccount = accountsArray.find(acc => acc.emailAddress === from);
        if (!subAccount) throw new Error(`From address '${from}' not found in Zoho sub-accounts.`);

        const formattedFromAddress = fromName ? `"${fromName}" <${from}>` : from;

        const response = await axios.post(`https://mail360.zoho.com/api/accounts/${subAccount.account_key}/messages`, {
            fromAddress: formattedFromAddress, toAddress: to, subject: subject, content: content, mailFormat: 'html'
        }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        
        res.status(202).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Zoho API Error", details: error.response?.data || error.message });
    }
});

// GET BOUNCES
router.get('/bounces', async (req, res) => {
    try {
        const response = await axios.get(WORKER_URL, { headers: { 'Accept': 'application/json' } });
        const rawData = response.data;
        let dataArray = [];

        if (Array.isArray(rawData)) {
            dataArray = rawData;
        } else if (typeof rawData === 'object' && rawData !== null && !rawData.includes) {
            dataArray = Object.values(rawData);
        } else if (typeof rawData === 'string' && rawData.trim().startsWith('<')) {
            let cleanHtml = rawData.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            let searchIdx = 0;
            while (true) {
                let startIdx = cleanHtml.indexOf('{', searchIdx);
                if (startIdx === -1) break;
                let braceCount = 0, endIdx = -1, insideQuotes = false, escapeNext = false;
                for (let i = startIdx; i < cleanHtml.length; i++) {
                    let char = cleanHtml[i];
                    if (escapeNext) { escapeNext = false; continue; }
                    if (char === '\\') { escapeNext = true; continue; }
                    if (char === '"') { insideQuotes = !insideQuotes; continue; }
                    if (!insideQuotes) {
                        if (char === '{') braceCount++;
                        if (char === '}') braceCount--;
                        if (braceCount === 0) { endIdx = i; break; }
                    }
                }
                if (endIdx !== -1) {
                    try {
                        let parsed = JSON.parse(cleanHtml.substring(startIdx, endIdx + 1));
                        if (parsed && (parsed.account_key || parsed.event || parsed.message_id)) dataArray.push(parsed);
                    } catch(e) {}
                    searchIdx = endIdx + 1;
                } else {
                    searchIdx = startIdx + 1;
                }
            }
        }

        const formattedBounces = dataArray.map((item, index) => {
            let timestamp = new Date().toISOString();
            try {
                if (item.received_time) timestamp = new Date(parseInt(item.received_time)).toISOString();
                else if (item.send_time_in_gmt) timestamp = new Date(parseInt(item.send_time_in_gmt)).toISOString();
                else if (item.timestamp) timestamp = new Date(item.timestamp).toISOString();
            } catch(e) {}

            const rawReason = item.summary || item.bounce_reason || item.reason || 'No reason provided';
            const rawEvent = item.event || item.bounceType || 'Unknown';

            return {
                id: item.message_id || item.id || `bounce-${Date.now()}-${index}`,
                email: item.email || item.delivered_to || item.recipient || 'Unknown',
                // PASS RAW DATA THROUGH SMART ANALYZER
                event: analyzeBounceReason(rawReason, rawEvent), 
                reason: rawReason,
                timestamp: timestamp,
                accountKey: item.account_key || item.accountKey || null,
                fromAddress: item.from_address || null
            };
        });
        
        formattedBounces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(formattedBounces);
        
    } catch (error) {
        res.status(500).json({ error: "Failed to connect to Cloudflare Worker", details: error.message });
    }
});

router.delete('/bounces', async (req, res) => {
    try {
        await axios.delete(WORKER_URL);
        res.json({ success: true, message: "Clear request sent to Worker" });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear bounces." });
    }
});

module.exports = router;