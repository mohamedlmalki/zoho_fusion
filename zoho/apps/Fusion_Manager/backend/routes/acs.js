const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { CommunicationServiceManagementClient } = require("@azure/arm-communication");
const { ClientSecretCredential } = require("@azure/identity");
const fs = require('fs').promises;
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, '../accounts.json');

// Helper function to extract the ACS account
const getAccountByAuth = async (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace('Bearer ', '').trim();
    const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
    const accounts = JSON.parse(data);
    
    const account = accounts.find(a => 
        (a.apiKey === token || a.credentials?.clientSecret === token) && 
        a.provider === 'acs'
    );
    
    if (!account) throw new Error("Azure ACS Account not found in database.");
    return account;
};

// 1. Connection Check
router.post('/check-status', async (req, res) => {
    try {
        const account = await getAccountByAuth(req);
        const { smtpUsername, clientSecret } = account.credentials;
        
        let transporter = nodemailer.createTransport({
            host: 'smtp.azurecomm.net',
            port: 587,
            secure: false, 
            auth: { user: smtpUsername, pass: clientSecret }
        });
        
        await transporter.verify();
        res.status(200).json({ status: 'ok', message: 'Connected to Azure SMTP successfully!' });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// 2. Change Sender Name
router.post('/update-name', async (req, res) => {
    try {
        const { newName, credentials } = req.body; 
        const { tenantId, clientId, clientSecret, subscriptionId, resourceGroup, emailServiceName, domainName, senderAddress } = credentials;

        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = new CommunicationServiceManagementClient(credential, subscriptionId);

        const senderUsername = senderAddress ? senderAddress.split('@')[0] : "donotreply";

        const result = await client.senderUsernames.createOrUpdate(
            resourceGroup,
            emailServiceName,
            domainName,
            senderUsername,
            { displayName: newName, username: senderUsername }
        );
        res.status(200).json({ success: true, displayName: result.displayName });
    } catch (error) {
        res.status(500).json({ error: "Azure API Error: " + error.message });
    }
});

// 3. Send Single Email
router.post('/send', async (req, res) => {
    try {
        const account = await getAccountByAuth(req);
        const { smtpUsername, clientSecret, senderAddress } = account.credentials;
        const { to, subject, content } = req.body;

        let transporter = nodemailer.createTransport({
            host: 'smtp.azurecomm.net',
            port: 587,
            secure: false, 
            auth: { user: smtpUsername, pass: clientSecret }
        });

        let info = await transporter.sendMail({
            from: senderAddress, 
            to: to,
            subject: subject,
            html: content
        });

        res.status(200).json({ id: info.messageId, status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. THE MAGIC FETCH ROUTE: Scans Azure for available profiles
router.post('/fetch-resources', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret } = req.body;
        
        // Login to Entra ID to get a temporary VIP pass
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const tokenResponse = await credential.getToken("https://management.azure.com/.default");
        const headers = { Authorization: `Bearer ${tokenResponse.token}` };

        // Step 1: Get Subscriptions
        const subsRes = await fetch('https://management.azure.com/subscriptions?api-version=2020-01-01', { headers });
        const subsData = await subsRes.json();
        if (subsData.error) throw new Error(subsData.error.message);

        let profiles = [];

        // Step 2: Iterate through Subscriptions to find Email Services
        for (const sub of (subsData.value || [])) {
            const emailSvcRes = await fetch(`https://management.azure.com/subscriptions/${sub.subscriptionId}/providers/Microsoft.Communication/emailServices?api-version=2023-04-01-preview`, { headers });
            const emailSvcData = await emailSvcRes.json();
            
            for (const emailSvc of (emailSvcData.value || [])) {
                // Extract the folder (Resource Group) name from the URL ID
                const rgMatch = emailSvc.id.match(/resourceGroups\/([^\/]+)/i);
                const resourceGroup = rgMatch ? rgMatch[1] : '';

                // Step 3: Get Domains inside the Email Service
                const domainsRes = await fetch(`https://management.azure.com${emailSvc.id}/domains?api-version=2023-04-01-preview`, { headers });
                const domainsData = await domainsRes.json();

                for (const domain of (domainsData.value || [])) {
                    // Step 4: Get Sender Usernames inside the Domain
                    const sendersRes = await fetch(`https://management.azure.com${domain.id}/senderUsernames?api-version=2023-04-01-preview`, { headers });
                    const sendersData = await sendersRes.json();

                    // Extract the actual hidden sending domain (e.g., xxxx.azurecomm.net)
                    const actualDomainName = domain.properties?.mailFromSenderDomain || domain.name;

                    for (const sender of (sendersData.value || [])) {
                        profiles.push({
                            label: `${emailSvc.name} (${domain.name}) - ${sender.name}`,
                            subscriptionId: sub.subscriptionId,
                            resourceGroup: resourceGroup,
                            emailServiceName: emailSvc.name,
                            domainName: domain.name,
                            smtpUsername: sender.properties?.username || sender.name,
                            senderAddress: `${sender.properties?.username || sender.name}@${actualDomainName}`
                        });
                    }
                }
            }
        }

        res.status(200).json({ profiles });
    } catch (error) {
        res.status(500).json({ error: "Failed to scan Azure account: " + error.message });
    }
});

router.post('/get-name', async (req, res) => {
    try {
        const account = await getAccountByAuth(req);
        const { tenantId, clientId, clientSecret, subscriptionId, resourceGroup, emailServiceName, domainName, senderAddress } = account.credentials;

        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = new CommunicationServiceManagementClient(credential, subscriptionId);

        const senderUsername = senderAddress ? senderAddress.split('@')[0] : "donotreply";

        // Fetch the current settings from Azure
        const sender = await client.senderUsernames.get(
            resourceGroup,
            emailServiceName,
            domainName,
            senderUsername
        );

        res.status(200).json({ displayName: sender.displayName });
    } catch (error) {
        res.status(500).json({ error: "Azure API Error: " + error.message });
    }
});

module.exports = router;