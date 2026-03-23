const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    console.log(`\n[OMNISEND] 📩 Incoming ${req.method} request to ${req.originalUrl}`);
    if (req.body && !req.body.importData) {
        console.log(`[OMNISEND] 📦 Body:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// Helper: Omnisend Client
const getOmnisendClient = (apiKey) => {
    if (!apiKey) {
        throw new Error("API Key missing");
    }
    return axios.create({
        baseURL: "https://api.omnisend.com/v5",
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        timeout: 20000
    });
};

// --- ROUTES ---

// 1. Check Status (Validation)
router.post("/check-status", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getOmnisendClient(apiKey);
        // We fetch 1 contact just to verify the key works
        const response = await client.get('/contacts', { params: { limit: 1 } });
        
        console.log("[OMNISEND] ✅ Status Check: Connected.");
        res.json({ status: 'connected', response: { statusCode: response.status } });
    } catch (error) {
        console.error("[OMNISEND] ❌ Status Check Failed:", error.message);
        res.status(401).json({ 
            status: 'failed', 
            response: error.response?.data || error.message 
        });
    }
});

// 2. Import Contact
router.post("/import/contact", async (req, res) => {
    const { apiKey, contact } = req.body;
    
    if (!apiKey || !contact?.email) {
        return res.status(400).json({ error: "Missing API Key or Email" });
    }

    try {
        const client = getOmnisendClient(apiKey);
        
        // Transform Fusion Manager contact format to Omnisend v5 Payload
        const payload = {
            identifiers: [
                {
                    type: "email",
                    id: contact.email,
                    channels: {
                        email: {
                            status: "subscribed",
                            statusDate: new Date().toISOString()
                        }
                    }
                }
            ],
            firstName: contact.firstName || "",
            lastName: contact.lastName || ""
        };

        // Send to Omnisend
        const response = await client.post('/contacts', payload);
        
        res.status(202).json({ success: true, data: response.data });
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            success: false,
            error: "Import failed", 
            // THIS is the magic line that grabs the raw Omnisend response!
            details: error.response?.data || error.message 
        });
    }
});

module.exports = router;