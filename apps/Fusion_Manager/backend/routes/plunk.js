const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- 1. Check Status ---
router.post('/check-status', async (req, res) => {
    const { secretKey } = req.body;
    if (!secretKey) return res.status(400).json({ message: 'Missing Secret Key' });

    try {
        // UPDATED: Changed domain to next-api.useplunk.com and removed /v1/ from contacts
        const response = await axios.get('https://next-api.useplunk.com/contacts?limit=1', {
            headers: { 'Authorization': `Bearer ${secretKey}` }
        });
        res.json({ success: true, message: 'Connected to Plunk.', response: response.data });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Auth Failed', response: error.response?.data || error.message });
    }
});

// 2. Send Bulk Email
router.post('/send-email', async (req, res) => {
    // Extract fromName from the frontend request
    const { secretKey, to, subject, content, from, fromName } = req.body;
    
    if (!secretKey || !to || !subject || !content) {
         return res.status(400).json({ error: "Missing parameters" });
    }

    try {
        const payload = {
            to: to,
            subject: subject,
            body: content
        };
        
        // UPDATED: Format the 'from' parameter according to the new API spec
        if (from) {
            // If fromName is provided, send as object {email, name}. Otherwise, just the string.
            payload.from = fromName ? { email: from, name: fromName } : from;
        } else if (fromName) {
            payload.name = fromName;
        }

        // UPDATED: Changed domain to next-api.useplunk.com
        const response = await axios.post('https://next-api.useplunk.com/v1/send', payload, {
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        res.status(202).json(response.data);
    } catch (error) {
        console.error("[PLUNK] Send Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: "Plunk API Error", 
            details: error.response?.data || error.message 
        });
    }
});

// --- 3. Track Event ---
router.post('/track-event', async (req, res) => {
    const { secretKey, event, email, data } = req.body;
    try {
        // UPDATED: Changed domain to next-api.useplunk.com
        const response = await axios.post('https://next-api.useplunk.com/v1/track', {
            event, 
            email, 
            data: data || {}, 
            subscribed: true
        }, {
            headers: { 
                'Authorization': `Bearer ${secretKey}`, 
                'Content-Type': 'application/json' 
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Track Error", details: error.response?.data });
    }
});

// --- 4. Analytics & Logs ---
router.get('/logs', async (req, res) => {
    const { secretKey, page = 1, limit = 100 } = req.query;

    if (!secretKey) {
        return res.status(400).json({ success: false, error: "Missing Plunk API Key" });
    }

    try {
        // Since Plunk's API doesn't expose historical logs to fetch programmatically,
        // we return a clean, empty structure so the frontend Analytics page doesn't crash.
        // If Plunk adds this API in the future, you can replace this with an axios.get() call.
        
        res.json({
            success: true,
            data: [], // Empty array = "No logs found"
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0,
                totalPages: 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch logs" });
    }
});

module.exports = router;