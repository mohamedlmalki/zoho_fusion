const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');

// Helper to read the local accounts database
const getAccount = async (id) => {
    try {
        const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
        const accounts = JSON.parse(data);
        return accounts.find(acc => acc.id === id);
    } catch (error) {
        console.error("[AHASEND] Error reading accounts.json:", error.message);
        return null;
    }
};

// --- ROUTES ---

// 1. Check Status
router.post("/check-status", async (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.startsWith('aha-sk-')) {
        return res.status(400).json({ status: 'failed', response: 'Invalid API Key format. Must start with aha-sk-' });
    }

    try {
        const response = await axios.get('https://api.ahasend.com/v2/ping', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        console.log("[AHASEND] ✅ Status Check: Connected.");
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        console.error("[AHASEND] ❌ Status Check Failed.");
        const details = error.response?.data || error.message;
        res.status(401).json({ status: 'failed', response: details });
    }
});

// 2. Send Email (UPDATED WITH BETTER ERROR LOGGING)
router.post('/send', async (req, res) => {
    const { accountId, from, recipients, subject, html_content, text_content } = req.body;

    if (!accountId || !from || !recipients || !subject || (!html_content && !text_content)) {
        return res.status(400).json({ error: 'Validation Error', details: 'Missing required fields for sending email.' });
    }

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: 'Account Not Found', details: 'Account not found in database.' });
        
        const ahaAccountId = account.ahaSendAccountId || account.apiUrl;
        if (!ahaAccountId) return res.status(400).json({ error: 'Config Error', details: 'Ahasend Account ID is missing.' });

        const response = await axios.post(`https://api.ahasend.com/v2/accounts/${ahaAccountId}/messages`, {
            from, recipients, subject, html_content, text_content
        }, {
            headers: { 'Authorization': `Bearer ${account.apiKey}` }
        });

        res.status(202).json(response.data);
    } catch (error) {
        console.error("[AHASEND] Send email error:", error.response?.data || error.message);
        
        // --- SEND COMPLETE ERROR DETAILS TO FRONTEND ---
        const errorPayload = {
            message: error.message,
            status: error.response?.status || 500,
            ahasend_raw_error: error.response?.data || "No additional details provided by Ahasend API"
        };
        
        res.status(error.response?.status || 500).json(errorPayload);
    }
});

// 3. Fetch Statistics
router.get('/statistics/:reportType', async (req, res) => {
    const { accountId, group_by, from_time, to_time } = req.query;
    const { reportType } = req.params;

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ message: 'Account not found.' });
        
        const ahaAccountId = account.ahaSendAccountId || account.apiUrl;

        const params = {};
        if (group_by) params.group_by = group_by;
        if (from_time) params.from_time = from_time;
        if (to_time) params.to_time = to_time;

        const response = await axios.get(`https://api.ahasend.com/v2/accounts/${ahaAccountId}/statistics/transactional/${reportType}`, {
            headers: { 'Authorization': `Bearer ${account.apiKey}` },
            params
        });

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
    }
});

// 4. Fetch Message Logs
router.get('/messages', async (req, res) => {
    const { accountId, limit, cursor, status, from_time, to_time } = req.query;

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ message: 'Account not found.' });
        
        const ahaAccountId = account.ahaSendAccountId || account.apiUrl;

        const params = { limit: limit || 100 };
        if (cursor) params.cursor = cursor;
        if (status && status !== 'all') params.status = status;
        
        if (!cursor && from_time) params.from_time = from_time;
        if (!cursor && to_time) params.to_time = to_time;

        const response = await axios.get(`https://api.ahasend.com/v2/accounts/${ahaAccountId}/messages`, {
            headers: { 'Authorization': `Bearer ${account.apiKey}` },
            params
        });

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
    }
});

// 5. Fetch Single Message Details
router.get('/messages/:messageId', async (req, res) => {
    const { accountId } = req.query;
    const { messageId } = req.params;

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ message: 'Account not found.' });
        
        const ahaAccountId = account.ahaSendAccountId || account.apiUrl;

        const response = await axios.get(`https://api.ahasend.com/v2/accounts/${ahaAccountId}/messages/${messageId}`, {
            headers: { 'Authorization': `Bearer ${account.apiKey}` }
        });

        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: error.message });
    }
});

module.exports = router;