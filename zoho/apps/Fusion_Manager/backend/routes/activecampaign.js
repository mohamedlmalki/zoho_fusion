const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    console.log(`\n[ACTIVE-CAMPAIGN] 📩 Incoming ${req.method} request to ${req.originalUrl}`);
    // Only log body if it's not huge
    if (req.body && !req.body.importData) { 
        console.log(`[ACTIVE-CAMPAIGN] 📦 Body:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// Helper: ActiveCampaign Client
const getACClient = (apiKey, apiUrl) => {
    if (!apiKey || !apiUrl) {
        console.error("[ACTIVE-CAMPAIGN] ❌ ERROR: Missing API Key or URL.");
        throw new Error("API Key or URL missing");
    }
    // Clean URL
    const baseURL = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return axios.create({
        baseURL: baseURL,
        headers: { 
            'Api-Token': apiKey,
            'Content-Type': 'application/json'
        },
        timeout: 15000 
    });
};

// --- ROUTES ---

// 1. Check Status
router.post("/check-status", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    try {
        const client = getACClient(apiKey, apiUrl);
        const response = await client.get('/api/3/users/me');
        console.log("[ACTIVE-CAMPAIGN] ✅ Status Check: Connected.");
        res.json({ status: 'connected', response: response.data });
    } catch (error) {
        logError("Check Status", error);
        res.status(401).json({ status: 'failed', response: error.response?.data || error.message });
    }
});

// 2. Fetch Lists
router.post("/lists", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    try {
        const client = getACClient(apiKey, apiUrl);
        const response = await client.get('/api/3/lists');
        // We map this to normalize it for the frontend dropdown
        const lists = response.data.lists.map(l => ({ listId: l.id, name: l.name }));
        console.log(`[ACTIVE-CAMPAIGN] ✅ Lists Fetched: Found ${lists.length} lists.`);
        res.json(lists);
    } catch (error) {
        logError("Fetch Lists", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Import Contact (FIXED)
router.post("/import/contact", async (req, res) => {
    const { apiKey, apiUrl, contact, listId } = req.body;
    if (!contact?.email || !listId) {
        return res.status(400).json({ error: "Missing email or listId" });
    }

    try {
        console.log(`[ACTIVE-CAMPAIGN] 🚀 Importing: ${contact.email} -> List ${listId}`);
        const client = getACClient(apiKey, apiUrl);
        
        // Step 1: Sync (Create/Update Contact)
        const syncRes = await client.post('/api/3/contact/sync', {
            contact: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName }
        });
        const contactId = syncRes.data.contact.id;

        // Step 2: Add to List
        const listRes = await client.post('/api/3/contactLists', {
            contactList: { list: listId, contact: contactId, status: 1 }
        });
        
        console.log(`[ACTIVE-CAMPAIGN] ✅ Import Success.`);
        
        // --- FIX: Return the FULL original response data ---
        // We merge the contact sync result and the list association result
        res.status(200).json({ 
            success: true,
            contactId: contactId,
            originalResponse: {
                contactSync: syncRes.data,
                listJoin: listRes.data
            }
        });

    } catch (error) {
        logError("Import Contact", error);
        // Include upstream error data if available so frontend sees why it failed
        res.status(500).json({ 
            error: "Import failed", 
            details: error.message,
            upstreamError: error.response?.data 
        });
    }
});

// --- USER MANAGEMENT ROUTES ---

// 4. Fetch Contacts by List
router.post("/contacts-by-list", async (req, res) => {
    const { apiKey, apiUrl, listId, page = 1, perPage = 10 } = req.body;
    try {
        console.log(`[ACTIVE-CAMPAIGN] 📡 Fetching contacts for List ${listId} (Page ${page})...`);
        const client = getACClient(apiKey, apiUrl);
        const offset = (page - 1) * perPage;
        
        const response = await client.get('/api/3/contacts', { 
            params: { 'listid': listId, 'limit': perPage, 'offset': offset, 'include': 'contactLists' } 
        });
        
        const contactLists = response.data.contactLists || [];
        const contactsWithListId = response.data.contacts.map(contact => {
            const contactList = contactLists.find(cl => cl.contact === contact.id && cl.list === listId);
            return { ...contact, contactListId: contactList?.id };
        });
        
        console.log(`[ACTIVE-CAMPAIGN] ✅ Found ${contactsWithListId.length} contacts.`);
        res.json({ contacts: contactsWithListId, total: parseInt(response.data.meta.total, 10) });
    } catch (error) {
        logError("Fetch Contacts By List", error);
        res.status(500).json({ error: error.message });
    }
});

// 5. Unsubscribe
router.post("/unsubscribe", async (req, res) => {
    const { apiKey, apiUrl, contacts } = req.body;
    try {
        console.log(`[ACTIVE-CAMPAIGN] 📡 Unsubscribing ${contacts.length} contacts...`);
        const client = getACClient(apiKey, apiUrl);
        
        await Promise.allSettled(contacts.map(contact => {
            if (contact.contactListId) {
                return client.put(`/api/3/contactLists/${contact.contactListId}`, { contactList: { status: 2 } });
            }
            return Promise.resolve();
        }));

        console.log(`[ACTIVE-CAMPAIGN] ✅ Unsubscribe complete.`);
        res.status(200).json({ message: "Unsubscribed" });
    } catch (error) {
        logError("Unsubscribe", error);
        res.status(500).json({ error: error.message });
    }
});

// 6. Delete Contacts
router.post("/delete-contacts", async (req, res) => {
    const { apiKey, apiUrl, contactIds } = req.body;
    try {
        console.log(`[ACTIVE-CAMPAIGN] 📡 Deleting ${contactIds.length} contacts...`);
        const client = getACClient(apiKey, apiUrl);
        
        await Promise.allSettled(contactIds.map(id => 
            client.delete(`/api/3/contacts/${id}`)
        ));
        
        console.log(`[ACTIVE-CAMPAIGN] ✅ Deletion complete.`);
        res.status(200).json({ message: "Deleted" });
    } catch (error) {
        logError("Delete Contacts", error);
        res.status(500).json({ error: error.message });
    }
});

// --- STATS ROUTES ---

router.post("/automations", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    try {
        const client = getACClient(apiKey, apiUrl);
        const response = await client.get('/api/3/automations');
        res.json(response.data.automations.map(a => ({ workflowId: a.id, name: a.name, status: a.status })));
    } catch (error) {
        logError("Fetch Automations", error);
        res.status(500).json({ error: error.message });
    }
});

router.post("/automations/:workflowId/stats", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    const { workflowId } = req.params;
    try {
        const client = getACClient(apiKey, apiUrl);
        const all = await client.get('/api/3/contactAutomations', { params: { 'filters[automation]': workflowId } });
        const active = await client.get('/api/3/contactAutomations', { params: { 'filters[automation]': workflowId, 'filters[status]': 1 } });
        const total = all.data.meta.total;
        const inProgress = active.data.meta.total;
        res.json({ subscriberStatistics: { totalEntrants: total, inProgressCount: inProgress, completedCount: total - inProgress } });
    } catch (error) {
        logError("Automation Stats", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

router.post("/campaigns", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    try {
        const client = getACClient(apiKey, apiUrl);
        const response = await client.get('/api/3/campaigns', { params: { limit: 100, orders: { sdate: 'DESC' } } });
        res.json(response.data);
    } catch (error) {
        logError("Fetch Campaigns", error);
        res.status(500).json({ error: error.message });
    }
});

router.post("/campaigns/:campaignId/stats", async (req, res) => {
    const { apiKey, apiUrl } = req.body;
    const { campaignId } = req.params;
    try {
        const client = getACClient(apiKey, apiUrl);
        const response = await client.get(`/api/3/campaigns/${campaignId}/reportTotals`);
        res.json(response.data);
    } catch (error) {
        logError("Campaign Stats", error);
        res.status(500).json({ error: error.message });
    }
});

function logError(action, error) {
    console.error(`\n[ACTIVE-CAMPAIGN] ❌ ERROR in ${action}:`);
    if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
        console.error(`   Message: ${error.message}`);
    }
}

module.exports = router;