const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- Auth Check ---
router.post('/check-status', async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ message: 'Missing API Token' });

    try {
        // WORKAROUND: Ping the Email endpoint with empty data instead of the Domains endpoint.
        // This completely avoids the #MS40301 Domain scope error.
        await axios.post('https://api.mailersend.com/v1/email', {}, {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ success: true, message: 'Connected to MailerSend.' });
    } catch (error) {
        // If MailerSend returns 422 or 400, it means the API Key IS VALID! 
        // It's just complaining that our dummy email has no subject/to/from.
        // This means the connection is successful!
        if (error.response?.status === 422 || error.response?.status === 400) {
            return res.json({ success: true, message: 'Connected to MailerSend (Verified via Email endpoint).' });
        }
        
        // If it returns 401 or 403 here, the token is truly dead.
        res.status(error.response?.status || 401).json({ 
            success: false, 
            message: `Authentication Failed (${error.response?.status || 'Unknown'})`, 
            details: error.response?.data || error.message 
        });
    }
});

// --- Send Email ---
router.post('/send-email', async (req, res) => {
    const { apiKey, to, subject, content, fromEmail, fromName } = req.body;
    
    if (!apiKey || !to || !subject || !content || !fromEmail) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
        let htmlContent = content;
        if (!htmlContent.trim().toLowerCase().startsWith('<html') && !htmlContent.includes('<body')) {
            htmlContent = `<!DOCTYPE html><html><body>${content}</body></html>`;
        }

        let textContent = String(content).replace(/<[^>]*>?/gm, " ").trim();
        if (!textContent || textContent.length === 0) {
            textContent = "Please view this email in an HTML compatible email client.";
        }

        const payload = {
            from: { email: fromEmail, name: fromName || undefined },
            to: [{ email: to, name: to }],
            subject: subject,
            html: htmlContent,
            text: textContent
        };

        const response = await axios.post('https://api.mailersend.com/v1/email', payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({ 
            success: true, 
            messageId: response.headers['x-message-id'],
            status: response.status 
        });
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Failed to send email", details: error.response?.data });
    }
});

// --- Analytics / Activity Logs ---
router.get('/email/log', async (req, res) => {
    const { apiKey, limit = 25, page = 1, status } = req.query;
    if (!apiKey) return res.status(400).json({ error: "Missing API Key" });

    try {
        console.log("\n--- MAILERSEND ANALYTICS REQUEST ---");
        console.log("1. Fetching Domain ID automatically...");

        const domainResponse = await axios.get('https://api.mailersend.com/v1/domains', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const domainId = domainResponse.data.data?.[0]?.id;
        console.log(`2. Found Domain ID: ${domainId}`);

        if (!domainId) {
            console.log("-> No domains found, returning empty array.");
            return res.json({ success: true, data: [], message: "No domains found for this token." });
        }

        // Subtract 5 minutes (300 seconds) to fix server clock sync issues!
        const safeNow = Math.floor(Date.now() / 1000) - 300; 
        const oneDayAgo = safeNow - (24 * 60 * 60);    
        
        const params = { 
            limit, 
            page,
            date_from: oneDayAgo,
            date_to: safeNow
        };

        if (status === 'delivered') params.event = ['delivered'];
        if (status === 'failed') params.event = ['soft_bounced', 'hard_bounced'];
        if (status === 'opened') params.event = ['opened'];
        if (status === 'clicked') params.event = ['clicked'];
        if (status === 'spam') params.event = ['spam_complaint', 'junk'];

        console.log("3. Fetching Activity Logs with params:", params);
        const response = await axios.get(`https://api.mailersend.com/v1/activity/${domainId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            params: params
        });

        console.log(`4. Success! Fetched ${response.data.data.length} logs.`);

        const logs = response.data.data.map(activity => {
            let displayStatus = 'processing';
            if (activity.type === 'sent' || activity.type === 'delivered') displayStatus = 'delivered';
            else if (activity.type.includes('bounced')) displayStatus = 'failed';
            else if (activity.type === 'opened') displayStatus = 'opened';
            else if (activity.type === 'clicked') displayStatus = 'clicked';
            else if (activity.type === 'spam_complaint') displayStatus = 'spam';

            return {
                id: activity.id,
                type: activity.type, 
                // Fix: MailerSend nests 'recipient' inside the 'email' object
                to: activity.email?.recipient?.email || activity.recipient?.email || 'Unknown',
                from: activity.email?.from || 'Unknown',
                subject: activity.email?.subject || 'No Subject',
                status: displayStatus, 
                detailedStatus: activity.type.replace('_', ' '), 
                sentAt: activity.created_at,
                errorMessage: null 
            };
        });

        res.json({ 
            success: true, 
            data: logs,
            pagination: response.data.meta ? {
                page: response.data.meta.current_page,
                limit: response.data.meta.per_page,
                total: response.data.meta.total,
                totalPages: response.data.meta.last_page
            } : {}
        });

    } catch (error) {
        console.error("\n!!! MAILERSEND ANALYTICS ERROR !!!");
        console.error("Status:", error.response?.status);
        console.error("Data:", JSON.stringify(error.response?.data, null, 2));
        console.error("Message:", error.message);
        console.error("----------------------------------\n");

        res.status(error.response?.status || 500).json({ 
            success: false,
            error: "Failed to fetch logs", 
            details: error.response?.data || error.message 
        });
    }
});

module.exports = router;