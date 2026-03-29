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
        console.error("[GETRESPONSE] Error reading accounts.json:", error.message);
        return null;
    }
};

// Helper to create GetResponse client
const getApiClient = (apiKey) => {
    return axios.create({
        baseURL: 'https://api.getresponse.com/v3',
        headers: {
            'X-Auth-Token': `api-key ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
};

// 1. Check Status (Auth Check)
router.post('/check-status', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ message: 'Missing API Key' });

    try {
        const response = await getApiClient(apiKey).get('/accounts');
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        res.status(401).json({ status: 'failed', response: error.response?.data || error.message });
    }
});

// 2. Fetch Campaigns (Lists)
router.get('/campaigns', async (req, res) => {
    const { accountId } = req.query;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const response = await getApiClient(account.apiKey).get('/campaigns');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch campaigns", details: error.response?.data });
    }
});

// 3. Add Single Contact (Used by the BulkJobContext loop)
router.post('/contact', async (req, res) => {
    // BulkJobContext normally sends { to: email, subject: campaignId }
    const { accountId, to, subject } = req.body;
    const campaignId = req.body.campaignId || subject; 

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        // Allow users to pass "John Doe, john@email.com" in the text area
        let email = to;
        let name = '';
        if (to.includes(',')) {
            [name, email] = to.split(',').map(s => s.trim());
        }

        const payload = {
            email: email,
            campaign: { campaignId: campaignId }
        };
        if (name) payload.name = name;

        const response = await getApiClient(account.apiKey).post('/contacts', payload);
        res.status(202).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            error: "Failed to add contact", 
            details: error.response?.data?.message || error.message 
        });
    }
});

// 4. Get Contacts (For User Management Page)
router.get('/contacts', async (req, res) => {
    const { accountId, campaignId, page = 1, limit = 25 } = req.query;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });
        
        const response = await getApiClient(account.apiKey).get('/contacts', {
            params: {
                'query[campaignId]': campaignId,
                'page': page,
                'perPage': limit,
                'sort[createdOn]': 'desc'
            }
        });
        const total = response.headers['total-count'] || 0;
        res.json({ contacts: response.data, total: parseInt(total, 10) });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contacts", details: error.response?.data });
    }
});

// 5. Delete Contacts (For User Management Page)
router.delete('/contacts', async (req, res) => {
    const { accountId, emails, campaignId } = req.body;
    if (!emails || !campaignId) return res.status(400).json({ error: "Missing parameters" });

    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });
        
        const client = getApiClient(account.apiKey);
        const allContactsResponse = await client.get('/contacts', {
            params: { 'query[campaignId]': campaignId, 'fields': 'contactId,email' }
        });
        
        const contactsToDelete = allContactsResponse.data.filter(c => emails.includes(c.email));

        for (const contact of contactsToDelete) {
            await client.delete(`/contacts/${contact.contactId}`);
        }

        res.json({ message: `${contactsToDelete.length} contact(s) deleted successfully` });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete contacts", details: error.response?.data });
    }
});

// 6. Get Workflows (For Automations Page)
router.get('/workflows', async (req, res) => {
    const { accountId } = req.query;
    try {
        const account = await getAccount(accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const response = await getApiClient(account.apiKey).get('/workflow');
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch workflows", details: error.response?.data });
    }
});

module.exports = router;