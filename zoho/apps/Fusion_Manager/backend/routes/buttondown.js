const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    next();
});

// Helper: Buttondown Client
const getClient = (apiKey) => {
    if (!apiKey) throw new Error("API Key missing");
    return axios.create({
        baseURL: "https://api.buttondown.email/v1",
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 20000
    });
};

// --- ROUTES ---

// 1. Check Status
router.post("/check-status", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getClient(apiKey);
        const response = await client.get('/emails', { params: { limit: 1 } });
        res.json({ status: 'connected', response: { status: response.status } });
    } catch (error) {
        res.status(401).json({ status: 'failed', response: error.message });
    }
});

// 2. Import Contact
router.post("/import/contact", async (req, res) => {
    const { apiKey, contact } = req.body;
    try {
        const client = getClient(apiKey);
        const payload = {
            email_address: contact.email,
            type: 'regular',
            tags: contact.tags || []
        };
        if (contact.firstName) payload.notes = `Name: ${contact.firstName}`;
        
        const response = await client.post('/subscribers', payload);
        res.status(201).json({ success: true, id: response.data.id });
    } catch (error) {
        res.status(400).json({ error: "Import failed", details: error.response?.data || error.message });
    }
});

// 3. Get Subscribers
router.post("/subscribers", async (req, res) => {
    const { apiKey, page = 1 } = req.body;
    try {
        const client = getClient(apiKey);
        const response = await client.get('/subscribers', { params: { page } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch subscribers" });
    }
});

// 4. Get Emails
router.post("/emails", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getClient(apiKey);
        const response = await client.get('/emails');
        res.json(response.data.results || response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch emails" });
    }
});

// 5. Send Email
router.post("/send-email", async (req, res) => {
    const { apiKey, subject, body, tags, status } = req.body;
    try {
        const client = getClient(apiKey);
        
        let finalStatus = 'draft'; 
        if (status === 'sent') finalStatus = 'about_to_send';
        else if (status === 'draft') finalStatus = 'draft';
        else if (status === 'scheduled') finalStatus = 'scheduled';

        const payload = {
            subject,
            body,
            tags: tags || [],
            email_type: 'public',
            status: finalStatus
        };

        const response = await client.post('/emails', payload);
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || "Failed to send email" });
    }
});

// 6. Email Analytics
router.post("/emails/:emailId/analytics", async (req, res) => {
    const { apiKey } = req.body;
    const { emailId } = req.params;
    try {
        const client = getClient(apiKey);
        const response = await client.get(`/emails/${emailId}/analytics`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// 7. Get Newsletter Info (FIXED)
router.post("/newsletter", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getClient(apiKey);
        const response = await client.get('/newsletters');
        
        // Buttondown returns a list. We take the first one.
        const newsletter = response.data.results?.[0];
        
        if (newsletter) {
            console.log(`[BUTTONDOWN] Found Newsletter: ${newsletter.name}`);
            // Normalize the response so Frontend always finds 'from_name'
            res.json({
                ...newsletter,
                from_name: newsletter.name || newsletter.author_name || "Unknown"
            });
        } else {
            console.warn("[BUTTONDOWN] No newsletter found in account.");
            res.status(404).json({ error: "No newsletter found" });
        }
    } catch (error) {
        console.error("[BUTTONDOWN] Failed to fetch newsletter:", error.message);
        res.status(500).json({ error: "Failed to fetch newsletter info" });
    }
});

// 8. Update Newsletter
router.patch("/newsletter/:id", async (req, res) => {
    const { apiKey, from_name } = req.body;
    const { id } = req.params;
    try {
        const client = getClient(apiKey);
        // Buttondown uses 'name' for the newsletter title
        const response = await client.patch(`/newsletters/${id}`, { name: from_name });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: "Failed to update sender name" });
    }
});

// 9. Get Email Events
router.post("/events", async (req, res) => {
    const { apiKey, emailId, eventType } = req.body;
    try {
        const client = getClient(apiKey);
        const params = { email_id: emailId };
        if (eventType) params.event_type = eventType;

        const response = await client.get('/events', { params });
        res.json(response.data.results || response.data);
    } catch (error) {
        res.json([]); 
    }
});

// 10. Delete Subscriber
router.post("/subscribers/:id/delete", async (req, res) => {
    const { apiKey } = req.body;
    const { id } = req.params;
    try {
        const client = getClient(apiKey);
        await client.delete(`/subscribers/${id}`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete subscriber" });
    }
});

// 11. Bulk Delete Subscribers
router.post("/subscribers/bulk-delete", async (req, res) => {
    const { apiKey, ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Invalid ID list" });

    try {
        const client = getClient(apiKey);
        await Promise.all(ids.map(id => client.delete(`/subscribers/${id}`).catch(e => console.error(e))));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to bulk delete subscribers" });
    }
});

// 12. Update Email
router.patch("/emails/:id", async (req, res) => {
    const { apiKey, subject, body, status } = req.body;
    const { id } = req.params;
    try {
        const client = getClient(apiKey);
        const payload = {};
        if (subject) payload.subject = subject;
        if (body) payload.body = body;
        if (status) payload.status = status;

        const response = await client.patch(`/emails/${id}`, payload);
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: "Failed to update email" });
    }
});

module.exports = router;