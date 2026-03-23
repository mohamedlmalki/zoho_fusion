const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- LOGGING MIDDLEWARE ---
router.use((req, res, next) => {
    console.log(`\n[BENCHMARK] 📩 Incoming ${req.method} request to ${req.originalUrl}`);
    if (req.body && !req.body.importData) { 
        console.log(`[BENCHMARK] 📦 Body:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// Helper: Benchmark Client
const getBMClient = (apiKey) => {
    if (!apiKey) {
        throw new Error("API Token missing");
    }
    return axios.create({
        baseURL: "https://clientapi.benchmarkemail.com",
        headers: { 
            'AuthToken': apiKey,
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
        const client = getBMClient(apiKey);
        const response = await client.get('/Client/Setting');
        if (response.data?.Response) {
            res.json({ status: 'connected', response: response.data.Response });
        } else {
            throw new Error("Invalid response");
        }
    } catch (error) {
        res.status(401).json({ status: 'failed', response: error.message });
    }
});

// 2. Fetch Lists
router.post("/lists", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBMClient(apiKey);
        const response = await client.get('/Contact/');
        if (response.data?.Response?.Data) {
            const lists = response.data.Response.Data.map(l => ({ 
                listId: l.ID, name: l.Name, count: l.ContactCount 
            }));
            res.json(lists);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Import Contact (FIXED)
router.post("/import/contact", async (req, res) => {
    const { apiKey, contact, listId } = req.body;
    if (!contact?.email || !listId) return res.status(400).json({ error: "Missing email or listId" });

    try {
        const client = getBMClient(apiKey);
        const payload = {
            Data: {
                Email: contact.email,
                FirstName: contact.firstName || "",
                LastName: contact.lastName || "",
                EmailPerm: "1"
            }
        };

        const response = await client.post(`/Contact/${listId}/ContactDetails`, payload);
        const result = response.data.Response;

        console.log(`[BENCHMARK] Import Response for ${contact.email}:`, JSON.stringify(result));

        // Success if Status is 1 OR if we got a valid ID back
        const isSuccess = (result.Status === 1 || result.Status === "1") || (result.ID && parseInt(result.ID) > 0);

        if (isSuccess) {
            res.status(202).json({ 
                success: true, 
                data: result 
            });
        } else {
            console.error(`[BENCHMARK] ❌ Import deemed failure:`, result);
            // We return 400 so frontend knows it failed, but we include "details" with the full response
            res.status(400).json({ 
                error: "API Failure", 
                details: result 
            });
        }
    } catch (error) {
        console.error(`[BENCHMARK] 💥 Exception:`, error.message);
        res.status(500).json({ 
            error: "Import failed", 
            details: error.message,
            upstreamError: error.response?.data 
        });
    }
});

// 4. Fetch Contacts
router.post("/contacts-by-list", async (req, res) => {
    const { apiKey, listId, page = 1, perPage = 20 } = req.body;
    try {
        const client = getBMClient(apiKey);
        const response = await client.get(`/Contact/${listId}/ContactDetails`, { 
            params: { PageNumber: page, PageSize: perPage } 
        });
        if (response.data?.Response?.Data) {
            const contacts = response.data.Response.Data.map(c => ({
                id: c.ID, email: c.Email, firstName: c.FirstName, lastName: c.LastName,
                status: c.EmailPerm, dateAdded: c.CreatedDate
            }));
            res.json({ contacts, total: parseInt(response.data.Response.Count || '0', 10) });
        } else {
            res.json({ contacts: [], total: 0 });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

// 5. Delete Contacts
router.delete("/lists/:listId/contacts", async (req, res) => {
    const { apiKey, contactIds } = req.body;
    const { listId } = req.params;
    if (!apiKey || !contactIds) return res.status(400).json({ error: "Missing fields" });

    const client = getBMClient(apiKey);
    let successCount = 0;
    
    await Promise.allSettled(contactIds.map(async (id) => {
        const response = await client.delete(`/Contact/${listId}/ContactDetails/${id}`);
        if (response.data?.Response?.Status === "1" || response.data?.Response?.Status === 1) {
            successCount++;
        }
    }));
    res.json({ message: "Deletion complete", successCount });
});

// 6. Unsubscribe
router.post("/unsubscribe", async (req, res) => {
    const { apiKey, contacts } = req.body;
    try {
        const client = getBMClient(apiKey);
        const payload = { Data: { Contacts: contacts.map(c => ({ Email: c.email })) } };
        await client.post('/Contact/UnsubscribeContacts', payload);
        res.json({ message: "Unsubscribed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 7. Get Automations List
router.post("/automations", async (req, res) => {
    const { apiKey } = req.body;
    try {
        const client = getBMClient(apiKey);
        let response;
        try {
            response = await client.get('/Automations'); 
        } catch (err) {
            console.log("[BENCHMARK] ⚠️ /Automations failed, trying fallback...");
        }

        if (!response || !response.data?.Response?.Data) {
            try {
                response = await client.get('/Automation/Report');
            } catch (err) {
                return res.json([]); 
            }
        }

        if (response.data?.Response?.Data) {
            const automations = response.data.Response.Data.map(a => ({
                workflowId: a.ID,
                name: a.Name,
                status: String(a.Status), 
                contactCount: a.ContactCount || '0',
                fromName: a.FromName || 'N/A'
            }));
            res.json(automations);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch automations" });
    }
});

// 8. Get Automation Stats & IDs
router.post("/automations/:id/report", async (req, res) => {
    const { apiKey } = req.body;
    const { id } = req.params;
    try {
        console.log(`[BENCHMARK] 📡 Fetching Details for Automation ${id}...`);
        const client = getBMClient(apiKey);
        
        let configEmails = [];
        try {
            const detailRes = await client.get(`/Automation/${id}`);
            if (detailRes.data?.Response?.Emails) {
                configEmails = detailRes.data.Response.Emails;
            } else if (detailRes.data?.Response?.Detail?.Emails) {
                configEmails = detailRes.data.Response.Detail.Emails;
            }
        } catch (e) { console.log("[BENCHMARK] ⚠️ Failed to fetch /Automation/{id}"); }

        let reportEmails = [];
        try {
            const reportRes = await client.get(`/Automation/${id}/Report`);
            if (reportRes.data?.Response?.Data) {
                reportEmails = reportRes.data.Response.Data;
            }
        } catch (e) {}

        const baseList = configEmails.length > 0 ? configEmails : reportEmails;

        const result = baseList.map(item => {
            const stat = reportEmails.find(r => r.Subject === item.Subject) || {};
            const validId = item.ID || stat.ID;
            return {
                stepId: validId, 
                subject: item.Subject,
                sends: parseInt(item.Sends || stat.Sends || 0),
                opens: parseInt(item.Opens || stat.Opens || 0),
                clicks: parseInt(item.Clicks || stat.Clicks || 0),
                bounces: parseInt(item.Bounces || stat.Bounces || 0)
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch report" });
    }
});

// 9. Update "From Name"
router.patch("/automations/:id/from-name", async (req, res) => {
    const { apiKey, newFromName } = req.body;
    const { id } = req.params;
    if (!newFromName) return res.status(400).json({ error: "New name required" });

    try {
        const client = getBMClient(apiKey);
        const detailsRes = await client.get(`/Automation/${id}`);
        const current = detailsRes.data.Response;
        const payload = { Detail: { ...current, FromName: newFromName } };
        delete payload.Detail.ID; 
        const response = await client.patch(`/Automation/${id}`, payload);
        if (response.data?.Response?.Status === "1" || response.data?.Response?.Status === 1) {
            res.json({ success: true });
        } else {
            throw new Error("Benchmark refused update");
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to update automation" });
    }
});

// 10. Update Email Subject
router.patch("/automations/:automationId/emails/:emailId", async (req, res) => {
    const { apiKey, subject } = req.body;
    const { automationId, emailId } = req.params;
    if (!subject) return res.status(400).json({ error: "Subject is required" });

    try {
        console.log(`[BENCHMARK] 📝 Updating Subject for Email ${emailId}...`);
        const client = getBMClient(apiKey);
        
        let currentData = {};
        try {
            const getRes = await client.get(`/Automation/${automationId}/Emails/${emailId}`);
            if (getRes.data?.Response) currentData = getRes.data.Response;
        } catch (err) {}

        const payload = {
            Detail: {
                Subject: subject,
                Days: currentData.Days,
                ScheduleDays: currentData.ScheduleDays,
                ScheduleTime: currentData.ScheduleTime,
                TimeZone: currentData.TimeZone,
                GoogleCampaignName: currentData.GoogleCampaignName,
                HasGoogleCampaign: currentData.HasGoogleCampaign,
                HasPreviewText: currentData.HasPreviewText,
                PreviewText: currentData.PreviewText,
                IsBefore: currentData.IsBefore
            }
        };

        const response = await client.patch(`/Automation/${automationId}/Emails/${emailId}`, payload);
        if (response.data?.Response?.Status === "1" || response.data?.Response?.Status === 1) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Failed to update subject", details: response.data?.Response });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. Get Email Content (for Automations)
router.post("/automations/:automationId/emails/:emailId/content", async (req, res) => {
    const { apiKey } = req.body;
    const { automationId, emailId } = req.params;
    try {
        const client = getBMClient(apiKey);
        console.log(`[BENCHMARK] 📡 Fetching Content for Email ${emailId}...`);
        
        const response = await client.get(`/Automation/${automationId}/Emails/${emailId}`);
        
        if (response.data?.Response?.Content) {
            res.json({ content: response.data.Response.Content }); 
        } else if (response.data?.Response?.Detail?.Content) {
            res.json({ content: response.data.Response.Detail.Content });
        } else {
             res.json({ content: {} });
        }
    } catch (error) {
        console.error("Fetch Content Error:", error.message);
        res.status(500).json({ error: "Failed to fetch content" });
    }
});

// 12. Update Email Content for Automations (USING 'Detail' KEY)
router.patch("/automations/:automationId/emails/:emailId/content", async (req, res) => {
    const { apiKey, htmlContent } = req.body;
    const { automationId, emailId } = req.params;

    if (!htmlContent) return res.status(400).json({ error: "Content is required" });

    try {
        console.log(`[BENCHMARK] 📝 Updating HTML Content for Email ${emailId}...`);
        const client = getBMClient(apiKey);
        
        // 1. Get current ID to ensure validity
        let currentID = "";
        try {
            const getRes = await client.get(`/Automation/${automationId}/Emails/${emailId}`);
            if (getRes.data?.Response?.Content?.ID) {
                currentID = getRes.data.Response.Content.ID;
            }
        } catch(e) {}

        const textVersion = htmlContent.replace(/<[^>]*>?/gm, '');

        // 2. Payload with 'Detail' key
        const payload = {
            Detail: { 
                ID: currentID, 
                TemplateContent: htmlContent,
                TemplateText: textVersion, 
                EmailType: "Custom", 
                Version: "400" 
            }
        };

        console.log("[BENCHMARK] 📤 Sending PATCH Payload with 'Detail' key:", JSON.stringify(payload, null, 2));

        const response = await client.patch(`/Automation/${automationId}/Emails/${emailId}/Content`, payload);
        
         if (response.data?.Response?.Status === "1" || response.data?.Response?.Status === 1) {
            console.log("[BENCHMARK] ✅ Content Update Success");
            res.json({ success: true });
        } else {
             console.error("[BENCHMARK] ❌ Content Update Failed:", response.data);
            res.status(400).json({ error: "Failed to update content", details: response.data?.Response });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==============================================================================
// NEW ROUTES FOR "EMAILS / CAMPAIGNS" PAGE
// ==============================================================================

// 13. Get List of Regular Emails (Campaigns)
router.post("/emails", async (req, res) => {
    const { apiKey, page = 1, perPage = 15 } = req.body;
    if (!apiKey) return res.status(400).json({ error: "API Token required" });

    try {
        const client = getBMClient(apiKey);
        // Uses GET /Emails/ endpoint
        const response = await client.get(`/Emails/`, { 
            params: { PageNumber: page, PageSize: perPage } 
        });

        if (response.data?.Response?.Data) {
            const emails = response.data.Response.Data.map(e => ({
                id: e.ID,
                name: e.Name,
                subject: e.Subject,
                status: e.StatusText || e.Status, 
                modifiedDate: e.ModifiedDate
            }));
            res.json({ emails, total: parseInt(response.data.Response.Count || '0', 10) });
        } else {
            res.json({ emails: [], total: 0 });
        }
    } catch (error) {
        console.error("[BENCHMARK] ❌ Failed to fetch emails:", error.message);
        res.status(500).json({ error: "Failed to fetch emails" });
    }
});

// 14. Get Regular Email Details
router.post("/emails/:emailId", async (req, res) => {
    const { apiKey } = req.body;
    const { emailId } = req.params;
    if (!apiKey) return res.status(400).json({ error: "API Token required" });

    try {
        const client = getBMClient(apiKey);
        const response = await client.get(`/Emails/${emailId}`);

        if (response.data?.Response?.Data) {
            // Return full data so frontend can see TemplateContent and EmailType
            res.json(response.data.Response.Data);
        } else {
            throw new Error("Invalid response from Benchmark");
        }
    } catch (error) {
        console.error("[BENCHMARK] ❌ Failed to fetch email details:", error.message);
        res.status(500).json({ error: "Failed to fetch email details" });
    }
});

// 15. Update Regular Email
router.patch("/emails/:emailId", async (req, res) => {
    const { apiKey, updateData } = req.body;
    const { emailId } = req.params;

    if (!apiKey || !updateData) return res.status(400).json({ error: "Missing data" });

    try {
        const client = getBMClient(apiKey);
        console.log(`[BENCHMARK] 📝 Updating Email ID: ${emailId}`);

        // 1. Prepare Payload
        // Standard Benchmark API usually expects 'Data' wrapper for main entity updates
        const patchPayload = {
             Data: {
                 ...updateData
             }
        };

        // 2. Handle Content Updates (Auto-generate Text Version)
        if (updateData.TemplateContent) {
            const textVersion = updateData.TemplateContent.replace(/<[^>]*>?/gm, '');
            patchPayload.Data.TemplateText = textVersion;
        }

        console.log("[BENCHMARK] 📤 Sending PATCH payload for Email:", JSON.stringify(patchPayload, null, 2));

        const response = await client.patch(`/Emails/${emailId}`, patchPayload);

        if (response.data?.Response?.Status === "1" || response.data?.Response?.Status === 1) {
             res.json({ success: true, data: response.data.Response.Data });
        } else {
             console.error("[BENCHMARK] ❌ Update failed:", response.data);
             res.status(400).json({ error: "Update failed", details: response.data?.Response });
        }
    } catch (error) {
        console.error("[BENCHMARK] ❌ API Error:", error.message);
        res.status(500).json({ error: "Failed to update email" });
    }
});

module.exports = router;