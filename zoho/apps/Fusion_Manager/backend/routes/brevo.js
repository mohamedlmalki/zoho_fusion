const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    console.log(`\n[BREVO] 📩 Incoming ${req.method} request to ${req.originalUrl}`);
    if (req.body && !req.body.htmlContent) {
        console.log(`[BREVO] 📦 Body:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// Helper: Brevo Client
const getBrevoApiClient = (apiKey) => {
    if (!apiKey) {
        throw new Error("Brevo API Key is missing.");
    }
    return axios.create({
        baseURL: "https://api.brevo.com/v3",
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });
};

// --- ROUTES ---

// 1. Check Status
router.post("/check-status", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const response = await client.get('/account');
        console.log("[BREVO] ✅ Status Check: Connected.");
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        const details = error.response?.data || error.message;
        res.status(401).json({ status: 'failed', response: details });
    }
});

// 2. Fetch Lists
router.post("/lists", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const response = await client.get('/contacts/lists', { params: { limit: 50 } });
        const lists = (response.data.lists || []).map(l => ({ id: l.id, name: l.name }));
        console.log(`[BREVO] ✅ Lists Fetched: ${lists.length}`);
        res.json(lists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Import Contact
router.post("/contact", async (req, res) => {
    const { apiKey, contact, listId } = req.body;
    if (!contact?.email || !listId) return res.status(400).json({ error: "Missing email or listId" });

    try {
        const client = getBrevoApiClient(apiKey);
        const payload = {
            email: contact.email,
            listIds: [parseInt(listId, 10)],
            updateEnabled: true, 
            attributes: {}
        };
        if (contact.firstName) payload.attributes.FIRSTNAME = contact.firstName;
        if (contact.lastName) payload.attributes.LASTNAME = contact.lastName;

        const response = await client.post('/contacts', payload);
        
        let responseBody = response.data;
        let contactId = response.data?.id;

        if (response.status === 204) {
             responseBody = { status: "updated", message: "Contact updated." };
        } else {
             responseBody = { status: "created", data: response.data };
        }

        res.status(200).json({
            success: true,
            contactId: contactId,
            originalResponse: responseBody
        });

    } catch (error) {
        const details = error.response?.data || { message: error.message };
        res.status(error.response?.status || 500).json({ error: "Import failed", details, originalResponse: details });
    }
});

// 4. List Contacts
router.post("/list-contacts", async (req, res) => {
    const { apiKey, listId, page = 1, perPage = 10 } = req.body;
    const limit = parseInt(perPage, 10);
    const offset = (parseInt(page, 10) - 1) * limit;

    try {
        const client = getBrevoApiClient(apiKey);
        const response = await client.get(`/contacts/lists/${listId}/contacts`, { params: { limit, offset } });
        res.json({ contacts: response.data.contacts || [], total: response.data.count || 0 });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

// 5. Delete Contacts
router.post("/delete-contacts", async (req, res) => {
    const { apiKey, emails } = req.body;
    const client = getBrevoApiClient(apiKey);
    const results = { success: [], failed: [] };
    for (const email of emails) {
        try {
            await client.delete(`/contacts/${encodeURIComponent(email)}`);
            results.success.push(email);
        } catch (error) {
            results.failed.push({ email, reason: error.message });
        }
    }
    res.json({ message: "Deletion process complete", details: results });
});

// 6. Fetch Senders (FIXED & IMPROVED)
router.post("/senders", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        console.log("[BREVO] 📡 Fetching Senders...");
        const response = await client.get('/senders');
        
        const senders = response.data.senders || [];
        console.log(`[BREVO] ✅ Found ${senders.length} senders.`);
        
        res.json(senders);
    } catch (error) {
        console.error("[BREVO] ❌ Fetch Senders Failed:", error.response?.data || error.message);
        const details = error.response?.data || { message: error.message };
        // Return the actual status code (e.g., 401 for bad key)
        res.status(error.response?.status || 500).json({ error: "Failed to fetch senders", details });
    }
});

// --- NEW ROUTE: Update Sender Name ---
router.put("/senders/:id", async (req, res) => {
    const { apiKey, name } = req.body;
    const { id } = req.params;

    if (!name) return res.status(400).json({ error: "Name is required" });

    try {
        console.log(`[BREVO] 📝 Updating Sender ${id} to name: "${name}"`);
        const client = getBrevoApiClient(apiKey);
        
        await client.put(`/senders/${id}`, { name });
        
        res.status(200).json({ success: true, message: "Sender name updated" });
    } catch (error) {
        console.error("[BREVO] ❌ Update Sender Failed:", error.response?.data || error.message);
        const details = error.response?.data || { message: error.message };
        res.status(error.response?.status || 500).json({ error: "Failed to update sender", details });
    }
});

// 7. Send Single Transactional Email
router.post("/smtp/send-single", async (req, res) => {
    const { apiKey, senderId, to, subject, htmlContent } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const payload = {
            sender: { id: parseInt(senderId) },
            to: [{ email: to.email, name: to.name }],
            subject,
            htmlContent
        };
        const response = await client.post('/smtp/email', payload);
        res.status(201).json(response.data);
    } catch (error) {
        const details = error.response?.data || { message: error.message };
        res.status(error.response?.status || 500).json({ error: "Failed to send", details });
    }
});

// 8. SMTP Templates
router.post("/templates", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const response = await client.get('/smtp/templates', { params: { templateStatus: true, limit: 100 } });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch templates" });
    }
});

// 9. Update Template
router.put("/templates/:id", async (req, res) => {
    const { apiKey, subject, htmlContent, sender, originalSenderId } = req.body;
    const { id } = req.params;
    try {
        const client = getBrevoApiClient(apiKey);
        const payload = { subject, htmlContent };
        if (sender) {
            payload.sender = { name: sender.name };
            if (originalSenderId) payload.sender.id = originalSenderId;
            else if (sender.email) payload.sender.email = sender.email;
        }
        await client.put(`/smtp/templates/${id}`, payload);
        res.sendStatus(204);
    } catch (error) {
        res.status(500).json({ error: "Failed to update template" });
    }
});

// 10. SMTP Stats
router.post("/smtp-stats/aggregated", async (req, res) => {
    const { apiKey, startDate, endDate } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const params = {};
        if (startDate && endDate) {
            params.startDate = startDate;
            params.endDate = endDate;
        }
        const response = await client.get('/smtp/statistics/aggregatedReport', { params });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

router.post("/smtp-stats/events", async (req, res) => {
    const { apiKey, event, limit, offset, startDate, endDate } = req.body;
    try {
        const client = getBrevoApiClient(apiKey);
        const params = { event, limit, offset, sort: 'desc' };
        if (startDate && endDate) {
            params.startDate = startDate;
            params.endDate = endDate;
        }
        const response = await client.get('/smtp/statistics/events', { params });
        res.json(response.data.events || []);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch events" });
    }
});

module.exports = router;