const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');

// Helper to read the central accounts database
const getAccount = async (id) => {
    try {
        const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
        const accounts = JSON.parse(data);
        return accounts.find(acc => acc.id === id);
    } catch (error) {
        console.error("[EMAILIT] Error reading accounts.json:", error.message);
        return null;
    }
};

// 1. Check Status (Auth Check) - UPGRADED TO v2
router.post('/check-status', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ message: 'Missing Secret Key' });

    try {
        const response = await axios.get('https://api.emailit.com/v2/domains', {
            headers: { 
                'Authorization': `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        res.status(401).json({ status: 'failed', response: 'Authentication Failed' });
    }
});

// 2. Send Bulk Email - UPGRADED TO v2
router.post('/send-email', async (req, res) => {
    const { accountId, to, subject, content, from } = req.body;
    if (!accountId || !to || !subject || !content) return res.status(400).json({ error: "Missing parameters" });

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const payload = {
            to: to,
            subject: subject,
            html: content,
            text: content.replace(/<[^>]*>?/gm, '')
        };
        if (from) payload.from = from;

        const response = await axios.post('https://api.emailit.com/v2/emails', payload, {
            headers: {
                'Authorization': `Bearer ${account.apiKey.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.status(202).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            error: "Emailit API Error", 
            details: error.response?.data || error.message 
        });
    }
});

/// 3. Analytics / Logs - UPGRADED TO v2 (WITH AGGRESSIVE FALLBACKS)
router.get('/log', async (req, res) => {
    const { accountId, limit = 25, page = 1, status } = req.query;

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found in database" });

        const params = { 
            limit: limit, 
            page: page,
            include_data: true 
        };

        if (status === 'delivered') params.type = 'email.delivered,email.accepted';
        if (status === 'failed') params.type = 'email.bounced,email.failed,email.rejected'; 
        if (status === 'opened') params.type = 'email.opened,email.loaded';
        if (status === 'clicked') params.type = 'email.clicked';
        if (status === 'spam') params.type = 'email.complained,email.unsubscribed,email.suppressed';

        const response = await axios.get('https://api.emailit.com/v2/events', {
            headers: { 
                'Authorization': `Bearer ${account.apiKey.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            params: params
        });

        const eventsList = response.data?.data || [];

        const logs = eventsList.map(event => {
            const data = event.data || {};
            const obj = data.object || {};

            // 1. Aggressive search for 'To' (handles strings, arrays, and nested objects)
            let toRaw = obj.to || data.to || data.recipient || data.email || event.recipient || event.email || 'Unknown';
            let toStr = 'Unknown';
            if (Array.isArray(toRaw) && toRaw.length > 0) {
                toStr = typeof toRaw[0] === 'string' ? toRaw[0] : (toRaw[0].email || 'Unknown');
            } else if (typeof toRaw === 'string') {
                toStr = toRaw;
            } else if (typeof toRaw === 'object' && toRaw.email) {
                toStr = toRaw.email;
            }

            // 2. Aggressive search for 'From'
            let fromRaw = obj.from || data.from || data.from_email || event.from_email || 'Unknown';
            let fromStr = 'Unknown';
            if (Array.isArray(fromRaw) && fromRaw.length > 0) {
                fromStr = typeof fromRaw[0] === 'string' ? fromRaw[0] : (fromRaw[0].email || 'Unknown');
            } else if (typeof fromRaw === 'string') {
                fromStr = fromRaw;
            } else if (typeof fromRaw === 'object' && fromRaw.email) {
                fromStr = fromRaw.email;
            }

            // 3. Aggressive search for 'Subject'
            const subjectStr = obj.subject || data.subject || event.subject || 'No Subject';
            
            const typeStr = String(event.type || 'unknown').toLowerCase();

            let evStatus = 'processing';
            if (typeStr.includes('deliver') || typeStr.includes('accept')) evStatus = 'delivered';
            else if (typeStr.includes('bounce') || typeStr.includes('fail') || typeStr.includes('reject')) evStatus = 'failed';
            else if (typeStr.includes('open') || typeStr.includes('load')) evStatus = 'opened';
            else if (typeStr.includes('click')) evStatus = 'clicked';
            else if (typeStr.includes('complain') || typeStr.includes('spam') || typeStr.includes('unsub') || typeStr.includes('suppress')) evStatus = 'spam';

            return {
                id: event.id || Math.random().toString(36).substr(2, 9),
                type: typeStr,
                to: toStr,
                from: fromStr,
                subject: subjectStr,
                status: evStatus,
                detailedStatus: typeStr.replace('email.', '').replace('_', ' '),
                sentAt: event.created_at || new Date().toISOString(),
                errorMessage: (evStatus === 'failed') ? (obj.error || obj.reason || data.error || data.reason || typeStr) : null
            };
        });

        res.json({ 
            success: true, 
            data: logs, 
            pagination: { 
                page: Number(page), 
                limit: Number(limit), 
                has_more: !!response.data.next_page_url 
            } 
        });

    } catch (error) {
        console.error("[EMAILIT] Analytics Fetch Error:", error.response?.data || error.message);
        
        if (error.response?.status === 403 || error.response?.status === 401) {
             return res.status(error.response.status).json({ 
                 error: "Permission Denied: Please verify your API Key has Full Access." 
             });
        }
        res.status(500).json({ error: error.response?.data?.message || error.message || "Failed to fetch logs from Emailit API" });
    }
});

// 4. Add Subscriber Track Event - UPGRADED TO v2
router.post('/track-event', async (req, res) => {
    const { accountId, event, email, data } = req.body; 
    if (!accountId || !event || !email) return res.status(400).json({ error: "Missing parameters" });

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const response = await axios.post(`https://api.emailit.com/v2/audiences/${event}/subscribers`, {
            email: email,
            custom_fields: data || {}
        }, {
            headers: {
                'Authorization': `Bearer ${account.apiKey.trim()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Failed to add subscriber", details: error.response?.data });
    }
});

module.exports = router;