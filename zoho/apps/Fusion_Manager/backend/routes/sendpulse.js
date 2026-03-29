// backend/routes/sendpulse.js
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const tokenCache = {};
const backgroundJobs = {};

const getAccessToken = async (clientId, clientSecret) => {
    const cacheKey = clientId;
    const now = Date.now();
    if (tokenCache[cacheKey] && tokenCache[cacheKey].expiresAt > now) {
        return tokenCache[cacheKey].token;
    }
    try {
        const response = await axios.post("https://api.sendpulse.com/oauth/access_token", {
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
        });
        const { access_token, expires_in } = response.data;
        tokenCache[cacheKey] = { token: access_token, expiresAt: now + ((expires_in - 60) * 1000) };
        return access_token;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Could not authenticate with SendPulse.");
    }
};

router.post("/check-status", async (req, res) => {
    const { clientId, secretId } = req.body;
    if (!clientId || !secretId) return res.status(400).json({ error: "Missing Client ID or Secret" });
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const response = await axios.get('https://api.sendpulse.com/user/balance/detail', { headers: { 'Authorization': `Bearer ${accessToken}` }});
        res.json({ success: true, response: response.data });
    } catch (error) {
        res.status(401).json({ success: false, error: "Auth Failed", details: error.message });
    }
});

router.post("/lists", async (req, res) => {
    const { clientId, secretId } = req.body;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const response = await axios.get('https://api.sendpulse.com/addressbooks', { headers: { 'Authorization': `Bearer ${accessToken}` }});
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch address books", details: error.response?.data || error.message });
    }
});

router.post("/contacts/bulk", async (req, res) => {
    const { clientId, secretId, contacts, addressBookId } = req.body;
    const results = { success: [], failed: [] };
    for (const contact of contacts) {
        try {
            const accessToken = await getAccessToken(clientId, secretId);
            const response = await axios.post(`https://api.sendpulse.com/addressbooks/${addressBookId}/emails`, 
                { emails: [contact] }, 
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            results.success.push({ email: contact.email, data: response.data });
        } catch (error) {
            results.failed.push({ email: contact.email, error: error.response?.data || error.message });
        }
    }
    res.json(results);
});

router.post("/subscribers", async (req, res) => {
    const { clientId, secretId, addressBookId, limit = 25, offset = 0 } = req.body;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const config = { headers: { 'Authorization': `Bearer ${accessToken}` } };
        const [emailsResponse, totalResponse] = await Promise.all([
            axios.get(`https://api.sendpulse.com/addressbooks/${addressBookId}/emails`, { ...config, params: { limit, offset } }),
            axios.get(`https://api.sendpulse.com/addressbooks/${addressBookId}/emails/total`, config)
        ]);
        res.json({ emails: emailsResponse.data, total: totalResponse.data.total });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscribers" });
    }
});

router.delete("/subscribers", async (req, res) => {
    const { clientId, secretId, addressBookId, emails } = req.body;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const response = await axios.delete(`https://api.sendpulse.com/addressbooks/${addressBookId}/emails`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            data: { emails }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to delete subscribers" });
    }
});

router.post("/automations", async (req, res) => {
    const { clientId, secretId } = req.body;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const response = await axios.get('https://api.sendpulse.com/a360/autoresponders/list', { headers: { 'Authorization': `Bearer ${accessToken}` }});
        res.json(response.data.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch automations" });
    }
});

router.post("/automations/:id/statistics", async (req, res) => {
    const { clientId, secretId } = req.body;
    const { id } = req.params;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const config = { headers: { 'Authorization': `Bearer ${accessToken}` } };
        const flowDetailsResponse = await axios.get(`https://api.sendpulse.com/a360/autoresponders/${id}`, config);
        const flowData = flowDetailsResponse.data;
        const emailElements = flowData.flows.filter(f => f.af_type === 'email');
        
        const totalStats = { sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, spam: 0, send_error: 0 };

        for (const emailElement of emailElements) {
            try {
                const statsResponse = await axios.get(`https://api.sendpulse.com/a360/stats/email/${emailElement.id}/group-stat`, config);
                const stats = statsResponse.data.data;
                totalStats.sent += stats.sent || 0;
                totalStats.delivered += stats.delivered || 0;
                totalStats.opened += stats.opened || 0;
                totalStats.clicked += stats.clicked || 0;
                totalStats.spam += stats.marked_as_spam || 0;
                totalStats.send_error += stats.errors || 0;
            } catch (e) {}
        }
        res.json({ started: flowData.starts, finished: flowData.end_count, in_queue: flowData.in_queue, ...totalStats });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch automation statistics" });
    }
});

router.post("/automations/action-subscribers", async (req, res) => {
    const { clientId, secretId, automationId, filterType } = req.body;
    try {
        const accessToken = await getAccessToken(clientId, secretId);
        const config = { headers: { 'Authorization': `Bearer ${accessToken}` } };
        const flowRes = await axios.get(`https://api.sendpulse.com/a360/autoresponders/${automationId}`, config);
        const emailElements = flowRes.data.flows.filter(f => f.af_type === 'email');
        
        let allSubscribers = [];
        for (const el of emailElements) {
            try {
                let offset = 0; const limit = 100;
                while (true) {
                    const listRes = await axios.get(`https://api.sendpulse.com/a360/stats/email/${el.id}/addresses`, { ...config, params: { limit, offset } });
                    if (!listRes.data.data || listRes.data.data.length === 0) break;
                    allSubscribers.push(...listRes.data.data);
                    offset += limit;
                }
            } catch (e) {}
        }

        const errStatuses = [3, 4, 5, 6, 7, 8, 10, 11, 12];
        let filtered = allSubscribers;
        if (filterType === 'opened') filtered = allSubscribers.filter(sub => sub.open_date !== null);
        if (filterType === 'clicked') filtered = allSubscribers.filter(sub => sub.redirect_date !== null);
        if (filterType === 'spam_by_user') filtered = allSubscribers.filter(sub => sub.is_spam === 1 || sub.delivered_status === 9);
        if (filterType === 'errors') filtered = allSubscribers.filter(sub => errStatuses.includes(sub.delivered_status));

        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch action subscribers" });
    }
});

module.exports = router;