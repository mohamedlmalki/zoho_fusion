const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;
const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");
const NOTES_FILE = path.join(__dirname, "notes.json");

// ==========================================
// IMPORTANT: PASTE YOUR WORKER URL HERE
// ==========================================
const WORKER_URL = "https://zoho-ops-logger.arfilm47.workers.dev"; 

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- FUSION GLOBAL LOGGER MIDDLEWARE ---
app.use((req, res, next) => {
    const path = req.path.toLowerCase();
    
    // 1. UPDATED ALLOWLIST: Added 'track' and 'event' to capture Plunk tracking
    const isAllowedAction = ['import', 'send', 'bulk', 'transactional', 'track', 'event', 'user', 'contact'].some(keyword => path.includes(keyword));
    
    // 2. EXTRA FAILSAFE: Explicitly block known spam
    const isSpam = ['/check-status', '/accounts', '/notes', '/subscribers', '/lists', '/automations'].some(keyword => path.includes(keyword));

    if (['POST', 'PUT'].includes(req.method) && path.startsWith('/api/') && isAllowedAction && !isSpam) {
        
        const parts = req.path.split('/');
        const provider = parts[2] || 'unknown';
        const action = parts[3] || 'action';
        
        const source = `fusion-${provider}`;
        const summary = `Action: ${action.replace(/-/g, ' ').toUpperCase()}`;

        let sanitizedBody = {};
        try {
            sanitizedBody = JSON.parse(JSON.stringify(req.body)); 
            if (sanitizedBody.apiKey) sanitizedBody.apiKey = '***REDACTED***';
            if (sanitizedBody.credentials) sanitizedBody.credentials = '***REDACTED***';
        } catch (e) {
            sanitizedBody = { error: "Could not parse body" };
        }

        // Terminal Log
        console.log(`\n[FUSION LOGGER] Sending Plunk Track -> Worker`);

        if (WORKER_URL !== "YOUR_CLOUDFLARE_WORKER_URL_HERE") {
            fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: req.method,
                    source: source,
                    summary: summary,
                    body: sanitizedBody
                })
            }).catch(err => console.error("Worker Sync Error:", err.message));
        }
    }
    next();
});
// ---------------------------------------

// --- 1. IMPORT ROUTERS ---
const activeCampaignRoutes = require('./routes/activecampaign');
const benchmarkRoutes = require('./routes/benchmark');
const omnisendRoutes = require('./routes/omnisend');
const buttondownRoutes = require('./routes/buttondown');
const brevoRoutes = require('./routes/brevo');
const systemIoRoutes = require('./routes/systemio');
const plunkRoutes = require('./routes/plunk');
const mailersendRoutes = require('./routes/mailersend'); 
const sendpulseRoutes = require('./routes/sendpulse');
const ahasendRoutes = require('./routes/ahasend'); 
const emailitRoutes = require('./routes/emailit'); 
const getresponseRoutes = require('./routes/getresponse'); 
const loopsRoutes = require('./routes/loops'); 
const zohomailRoutes = require('./routes/zohomail'); 
const acsRoutes = require('./routes/acs'); // <--- ADDED AZURE ACS

// --- 2. MOUNT ROUTERS ---
app.use('/api/activecampaign', activeCampaignRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/omnisend', omnisendRoutes);
app.use('/api/buttondown', buttondownRoutes);
app.use('/api/brevo', brevoRoutes);
app.use('/api/systemio', systemIoRoutes);
app.use('/api/plunk', plunkRoutes);
app.use('/api/mailersend', mailersendRoutes); 
app.use('/api/sendpulse', sendpulseRoutes);
app.use('/api/ahasend', ahasendRoutes);
app.use('/api/emailit', emailitRoutes); 
app.use('/api/getresponse', getresponseRoutes); 
app.use('/api/loops', loopsRoutes); 
app.use('/api/zohomail', zohomailRoutes); 
app.use('/api/acs', acsRoutes); // <--- ADDED AZURE ACS

// --- 3. CUSTOM NOTES MANAGEMENT ---
const readNotes = async () => {
    try {
        const data = await fs.readFile(NOTES_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw new Error("Could not read notes data.");
    }
};

app.get("/api/notes", async (req, res) => {
    try {
        res.json(await readNotes());
    } catch (error) {
        res.status(500).json({ error: "Failed to read notes" });
    }
});

app.post("/api/notes", async (req, res) => {
    try {
        const { serviceId, note } = req.body;
        const notes = await readNotes();
        notes[serviceId] = note;
        await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ error: "Failed to save note" });
    }
});

// --- 4. ACCOUNTS MANAGEMENT ---
const readAccounts = async () => {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error("Could not read accounts data.");
  }
};

const writeAccounts = async (accounts) => {
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
};

app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await readAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to read accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { name, provider, apiKey, apiUrl, defaultFrom, defaultEvent, credentials } = req.body;
    if (!name || !provider || !apiKey) return res.status(400).json({ error: "Missing required fields" });

    const accounts = await readAccounts();
    const newAccount = { 
      id: uuidv4(), 
      name, 
      provider, 
      apiKey, 
      apiUrl, 
      defaultFrom, 
      defaultEvent,
      credentials // Passed in for providers like ACS that need 8 variables
    };
    
    accounts.push(newAccount);
    await writeAccounts(accounts);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: "Failed to add account" });
  }
});

app.put("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider, apiKey, apiUrl, defaultFrom, defaultEvent, credentials } = req.body;
    let accounts = await readAccounts();
    const index = accounts.findIndex(acc => acc.id === id);
    
    if (index === -1) return res.status(404).json({ error: "Account not found" });
    
    accounts[index] = { 
      ...accounts[index], 
      name, 
      provider, 
      apiKey, 
      apiUrl, 
      defaultFrom, 
      defaultEvent,
      credentials 
    };
    
    await writeAccounts(accounts);
    res.status(200).json(accounts[index]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update account" });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        let accounts = await readAccounts();
        const filtered = accounts.filter(acc => acc.id !== id);
        
        if (accounts.length === filtered.length) return res.status(404).json({ error: "Account not found" });
        
        await writeAccounts(filtered);
        res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete account" });
    }
});

// Endpoint to check account status (Traffic Cop)
app.post("/api/accounts/check-status", async (req, res) => {
    const { provider } = req.body;
    
    if (provider === 'benchmark') {
        res.redirect(307, '/api/benchmark/check-status');
    } else if (provider === 'omnisend') {
        res.redirect(307, '/api/omnisend/check-status');
    } else if (provider === 'buttondown') {
        res.redirect(307, '/api/buttondown/check-status');
    } else if (provider === 'brevo') {
        res.redirect(307, '/api/brevo/check-status');
    } else if (provider === 'systemio') {
        res.redirect(307, '/api/systemio/check-status');
    } else if (provider === 'plunk') {
        res.redirect(307, '/api/plunk/check-status');
    } else if (provider === 'mailersend') {
        res.redirect(307, '/api/mailersend/check-status'); 
    } else if (provider === 'sendpulse') {
        res.redirect(307, '/api/sendpulse/check-status');
    } else if (provider === 'ahasend') {
        res.redirect(307, '/api/ahasend/check-status'); 
    } else if (provider === 'emailit') {
        res.redirect(307, '/api/emailit/check-status'); 
    } else if (provider === 'getresponse') {
        res.redirect(307, '/api/getresponse/check-status'); 
    } else if (provider === 'loops') {
        res.redirect(307, '/api/loops/check-status'); 
    } else if (provider === 'zohomail') { 
        res.redirect(307, '/api/zohomail/check-status'); 
    } else if (provider === 'acs') { // <--- ADDED AZURE ACS
        res.redirect(307, '/api/acs/check-status'); 
    } else {
        res.redirect(307, '/api/activecampaign/check-status');
    }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});