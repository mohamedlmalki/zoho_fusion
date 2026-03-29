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
        console.error("[LOOPS] Error reading accounts.json:", error.message);
        return null;
    }
};

// Helper to create Loops client
const getApiClient = (apiKey) => {
    return axios.create({
        baseURL: 'https://app.loops.so/api/v1',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
};

// 1. Check Status (Auth Check)
router.post('/check-status', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ message: 'Missing API Key' });

    try {
        const response = await getApiClient(apiKey).get('/api-key');
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        res.status(401).json({ status: 'failed', response: error.response?.data || error.message });
    }
});

// 2. Add Single Contact (Used by the BulkJobContext loop)
router.post('/contact', async (req, res) => {
    const { accountId, to } = req.body; 

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const payload = { email: to };

        const response = await getApiClient(account.apiKey).post('/contacts/create', payload);
        res.status(202).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            error: "Failed to add contact", 
            details: error.response?.data?.message || error.message 
        });
    }
});

// 3. Send Transactional Emails
router.post('/transactional', async (req, res) => {
    const { accountId, recipients, transactionalId, dataVariables } = req.body;
    if (!accountId || !recipients || !transactionalId) return res.status(400).json({ error: "Missing parameters" });

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        let parsedVariables = {};
        if (dataVariables) {
            try { parsedVariables = JSON.parse(dataVariables); } 
            catch (e) { return res.status(400).json({ error: "Invalid JSON in data variables" }); }
        }

        let sentCount = 0;
        let failedCount = 0;
        let errors = [];

        const client = getApiClient(account.apiKey);

        for (const email of recipients) {
            try {
                await client.post('/transactional', {
                    email: email,
                    transactionalId: transactionalId,
                    dataVariables: parsedVariables
                });
                sentCount++;
            } catch (err) {
                failedCount++;
                errors.push({ email, error: err.response?.data?.message || err.message });
            }
        }

        res.json({ success: true, sentCount, failedCount, errors });
    } catch (error) {
        res.status(500).json({ error: "Failed to send transactional emails", details: error.message });
    }
});

// 4. Find Contact (For User Management Page)
router.get('/contacts/find', async (req, res) => {
    const { accountId, email } = req.query;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });
        
        const response = await getApiClient(account.apiKey).get(`/contacts/find?email=${encodeURIComponent(email)}`);
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Failed to find contact", details: error.response?.data });
    }
});

// 5. Delete Contact (For User Management Page)
router.post('/contacts/delete', async (req, res) => {
    const { accountId, email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });
        
        const response = await getApiClient(account.apiKey).post('/contacts/delete', { email });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Failed to delete contact", details: error.response?.data });
    }
});

module.exports = router;