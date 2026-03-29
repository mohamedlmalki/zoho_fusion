const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    console.log(`\n[SYSTEM-IO] 📩 Incoming ${req.method} request to ${req.originalUrl}`);
    next();
});

// Helper: System.io Headers
const getSystemIoHeaders = (apiKey) => ({
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    'accept': 'application/json'
});

// 1. Check Status (Validation)
router.post("/check-status", async (req, res) => {
    const { apiKey } = req.body;
    try {
        // Using the communities endpoint as a lightweight connection test
        const response = await axios.get('https://api.systeme.io/api/community/communities', {
            headers: getSystemIoHeaders(apiKey)
        });
        console.log("[SYSTEM-IO] ✅ Status Check: Valid.");
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        console.error("[SYSTEM-IO] ❌ Status Check Failed:", error.message);
        res.status(401).json({ status: 'failed', response: error.response?.data || error.message });
    }
});

// 2. Fetch Tags
router.post("/tags", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const response = await axios.get('https://api.systeme.io/api/tags', {
            headers: getSystemIoHeaders(apiKey)
        });
        // System.io returns tags in the 'items' array or as a direct array
        const tags = response.data.items || response.data; 
        res.json(tags);
    } catch (error) {
        console.error("[SYSTEM-IO] ❌ Fetch Tags Failed:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. Import Contact (Create & Tag)
router.post("/import/contact", async (req, res) => {
    const { apiKey, contact, tagId } = req.body;
    
    if (!contact?.email) {
        return res.status(400).json({ error: "Missing email address" });
    }

    try {
        console.log(`[SYSTEM-IO] 🚀 Attempting to import: ${contact.email}`);
        
        // Step 1: Create Contact
        const payload = {
            email: contact.email,
        };
        
        if (contact.firstName) payload.firstName = contact.firstName;

        const createRes = await axios.post('https://api.systeme.io/api/contacts', payload, { 
            headers: getSystemIoHeaders(apiKey) 
        });
        
        const contactId = createRes.data.id;
        let tagResult = null;

        // Step 2: Assign Tag (if a valid tagId was provided)
        if (tagId && tagId !== 'no-tag') {
            try {
                const tagRes = await axios.post(`https://api.systeme.io/api/contacts/${contactId}/tags`, 
                    { tagId: parseInt(tagId) }, 
                    { headers: getSystemIoHeaders(apiKey) }
                );
                tagResult = tagRes.data;
            } catch (tagError) {
                console.warn(`[SYSTEM-IO] ⚠️ Tagging failed for ${contact.email}:`, tagError.message);
                tagResult = { error: tagError.message };
            }
        }

        res.status(200).json({ 
            success: true, 
            contactId: contactId,
            originalResponse: { contact: createRes.data, tag: tagResult }
        });

    } catch (error) {
        // --- IMPROVED ERROR HANDLING FOR 422 ERRORS ---
        const errorData = error.response?.data;
        
        console.error(`[SYSTEM-IO] ❌ Import Failed for ${contact.email}:`, JSON.stringify(errorData || error.message));
        
        // We return a 200 with success: false so the frontend can display the specific error details
        res.status(200).json({ 
            success: false,
            error: "Validation Failed", 
            // This captures the 'detail' or 'violations' from the System.io 422 response
            details: errorData?.detail || errorData?.violations || error.message 
        });
    }
});

module.exports = router;