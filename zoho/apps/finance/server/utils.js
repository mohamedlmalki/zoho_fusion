const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data'); 

const PROFILES_PATH = path.join(__dirname, 'profiles.json');
const SAVES_DIR = path.join(__dirname, 'saves');

// --- ENSURE DIRS EXIST ---
if (!fs.existsSync(SAVES_DIR)) {
    try {
        fs.mkdirSync(SAVES_DIR);
    } catch (e) {
        console.error("Could not create saves directory:", e);
    }
}

const tokenCache = {};

// --- PROFILE MANAGEMENT ---
const readProfiles = () => {
    try {
        if (fs.existsSync(PROFILES_PATH)) {
            const data = fs.readFileSync(PROFILES_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[ERROR] Could not read profiles.json:', error);
    }
    return [];
};

const writeProfiles = (profiles) => {
    try {
        fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    } catch (error) {
        console.error('[ERROR] Could not write to profiles.json:', error);
    }
};

// --- SAVE / LOAD FUNCTIONS ---
const listSaveFiles = () => {
    try {
        if (!fs.existsSync(SAVES_DIR)) return [];
        const files = fs.readdirSync(SAVES_DIR).filter(file => file.endsWith('.json'));
        // Sort by creation time (newest first)
        return files.sort((a, b) => {
            return fs.statSync(path.join(SAVES_DIR, b)).mtime.getTime() - 
                   fs.statSync(path.join(SAVES_DIR, a)).mtime.getTime();
        });
    } catch (e) {
        console.error("Error listing save files:", e);
        return [];
    }
};

const writeSaveFile = (filename, data) => {
    const safeName = filename.replace(/[^a-z0-9_\-]/gi, '_') + '.json';
    const filePath = path.join(SAVES_DIR, safeName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return safeName;
};

const readSaveFile = (filename) => {
    const safeName = path.basename(filename); 
    const filePath = path.join(SAVES_DIR, safeName);
    if (!fs.existsSync(filePath)) throw new Error("File not found");
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

// --- API HELPERS ---
const createJobId = (socketId, profileName, jobType) => `${socketId}_${profileName}_${jobType}`;

const parseError = (error) => {
    console.error("\n--- 🛑 ZOHO API ERROR LOG 🛑 ---");
    if (error.response) {
        console.error(`Status: ${error.response.status} ${error.response.statusText}`);
        console.error("URL:", error.config?.url);
        try {
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } catch(e) {
            console.error("Data:", error.response.data);
        }
    } else {
        console.error("Error Message:", error.message);
    }
    console.error("------------------------------\n");

    if (error.response) {
        if (error.response.data?.message) return { message: error.response.data.message, fullResponse: error.response.data };
        if (error.response.data?.code) return { message: `Code ${error.response.data.code}: ${error.response.data.message || 'Unknown Error'}`, fullResponse: error.response.data };
        return { message: `HTTP ${error.response.status}: ${error.response.statusText}`, fullResponse: error.response.data };
    }
    return { message: error.message || 'Network/Unknown Error', fullResponse: error.stack };
};

const getValidAccessToken = async (profile, service) => {
    if (!['inventory', 'expense', 'books', 'billing'].includes(service)) {
        throw new Error(`Service "${service}" is not supported.`);
    }

    const now = Date.now();
    const cacheKey = `${profile.profileName}_${service}`;

    if (tokenCache[cacheKey] && tokenCache[cacheKey].data.access_token && tokenCache[cacheKey].expiresAt > now) {
        return tokenCache[cacheKey].data;
    }
    
    if (!profile.refreshToken || !profile.clientId || !profile.clientSecret) {
        throw new Error(`Missing credentials for profile: ${profile.profileName}`);
    }

    try {
        const params = new URLSearchParams();
        params.append('refresh_token', profile.refreshToken);
        params.append('client_id', profile.clientId);
        params.append('client_secret', profile.clientSecret);
        params.append('grant_type', 'refresh_token');

        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (response.data.error) {
            if (response.data.error === 'invalid_client') throw new Error('Invalid Client ID or Secret.');
            throw new Error(JSON.stringify(response.data));
        }
        
        const { expires_in } = response.data;
        tokenCache[cacheKey] = { 
            data: response.data, 
            expiresAt: now + ((expires_in - 60) * 1000) 
        };
        
        return response.data;
    } catch (error) {
        const errMsg = error.response?.data?.error || error.message;
        console.error(`TOKEN_REFRESH_FAILED for ${profile.profileName}:`, errMsg);
        throw new Error(`Token Refresh Failed: ${errMsg}`);
    }
};

const makeApiCall = async (method, relativeUrl, data, profile, service, queryParams = {}) => {
    const tokenResponse = await getValidAccessToken(profile, service);
    const accessToken = tokenResponse.access_token;
    
    if (!accessToken) throw new Error('Failed to retrieve a valid access token.');

    let baseUrl = 'https://www.zohoapis.com/inventory/v1'; 
    if (service === 'expense') baseUrl = 'https://www.zohoapis.com/expense/v1';
    else if (service === 'books') baseUrl = 'https://www.zohoapis.com/books/v3';
    else if (service === 'billing') baseUrl = 'https://www.zohoapis.com/billing/v1';

    let cleanEndpoint = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
    if (baseUrl.endsWith('/v1') && cleanEndpoint.startsWith('/v1/')) {
        cleanEndpoint = cleanEndpoint.replace('/v1', '');
    }

    const fullUrl = `${baseUrl}${cleanEndpoint}`;
    const headers = { 'Authorization': `Zoho-oauthtoken ${accessToken}` };
    const params = { ...queryParams }; 
    
    if (service === 'expense') {
        if (profile.expense?.orgId) params.organization_id = profile.expense.orgId;
    } else if (service === 'books') {
        if (profile.books?.orgId) params.organization_id = profile.books.orgId;
    } else if (service === 'billing') {
        if (profile.billing?.orgId) params.organization_id = profile.billing.orgId;
    } else {
        if (profile.inventory?.orgId) params.organization_id = profile.inventory.orgId;
    }
    
    const axiosConfig = { method, url: fullUrl, data, headers, params };
    if (data instanceof FormData) {
        headers['Content-Type'] = `multipart/form-data; boundary=${data.getBoundary()}`;
    }
    
    return axios(axiosConfig);
};

// --- 🔥 SMART INTENTION LOGGER (FINAL CORRECTED VERSION) 🔥 ---
const logFrontendIntention = async (moduleName, frontendData) => {
    if (!frontendData) return;
    
    const WORKER_URL = "https://zoho-ops-logger.arfilm47.workers.dev";
    
    // 1. 🔥 FLATTEN NESTED DATA 🔥 
    let flatData = { ...frontendData };
    ['staticData', 'formData', 'defaultData'].forEach(wrapper => {
        if (flatData[wrapper] && typeof flatData[wrapper] === 'object') {
            Object.assign(flatData, flatData[wrapper]); 
            delete flatData[wrapper]; 
        }
    });

    // 2. 🔥 AGGRESSIVE DENY LIST 🔥
    // Removed 'displayNames' from this list so it actually gets logged!
    const denyList = [
        'activeProfile', 'selectedProfileName', 'delay', 'bulkDelay', 'stopAfterFailures', 
        'processedIds', 'socketId', 'sendCustomEmail', 'sendDefaultEmail', 
        'customEmailMethod', 'sendEmail', 'status', 'search_text', 'page', 'per_page',
        'concurrency', 'verifyLog', 'moduleApiName', 'moduleName', 'primaryFieldName', 'bulkField'
    ];
    
    // 3. 🔥 SMART SOURCE NAMING 🔥
    let service = 'inventory'; 
    let cleanName = moduleName;
    
    if (cleanName.toLowerCase().startsWith('books')) {
        service = 'books';
        cleanName = cleanName.substring(5);
    } else if (cleanName.toLowerCase().startsWith('billing')) {
        service = 'billing';
        cleanName = cleanName.substring(7);
    } else if (cleanName.toLowerCase().startsWith('expense')) {
        service = 'expense';
        cleanName = cleanName.substring(7);
    }

    if (cleanName.toLowerCase() === 'customjob' || cleanName.toLowerCase() === 'creation') {
        cleanName = 'custom-module';
    }
    
    let sourceName = `zoho-finance-${service}-${cleanName.toLowerCase()}`;
    
    let apiName = frontendData.moduleApiName || frontendData.moduleName;
    if (apiName && apiName.startsWith('cm_')) {
        sourceName += `-[${apiName.replace('cm_', '')}]`;
    }
    
    let extracted = {};
    let summaryParts = [];
    
    Object.keys(flatData).forEach(key => {
        if (denyList.includes(key)) return;
        
        let val = flatData[key];
        if (val === undefined || val === null || val === '') return;
        
        // 🔥 Beautiful Key Renaming 🔥
        let cleanKey = key.replace(/_/g, ' ');
        if (cleanKey === 'bulkData' || cleanKey === 'bulkValues') cleanKey = 'target emails';
        if (key === 'displayNames') cleanKey = 'Display Name (Applied to all)'; // Forces it to look exactly like your UI

        if (Array.isArray(val)) {
            extracted[key] = val.length > 50 ? val.slice(0, 50).join(', ') + `\n...[and ${val.length - 50} more]` : val.join(', ');
            
            if (val.length === 1) summaryParts.push(`${cleanKey}: ${val[0]}`);
            else if (val.length <= 3) summaryParts.push(`${cleanKey}: ${val.join(', ')}`);
            else summaryParts.push(`${cleanKey}: ${val[0]}, ${val[1]} ...[+${val.length - 2} more]`);
        } 
        else if (typeof val === 'string') {
            extracted[key] = val.length > 4000 ? val.substring(0, 4000) + '\n...[Truncated]' : val;
            
            if (val.includes('\n')) {
                const lines = val.split('\n').filter(e => e.trim() !== '');
                if (lines.length > 1) {
                    summaryParts.push(`${cleanKey}: [${lines.length} items]`);
                    return; 
                }
            }
            
            let cleanStr = val.replace(/<[^>]*>?/gm, '').trim(); 
            let shortStr = cleanStr.length > 45 ? cleanStr.substring(0, 45) + '...' : cleanStr;
            summaryParts.push(`${cleanKey}: ${shortStr}`);
        } 
        else if (typeof val !== 'object') {
            extracted[key] = val;
            summaryParts.push(`${cleanKey}: ${val}`);
        }
    });
    
    if (Object.keys(extracted).length === 0) return; 
    
    const finalSummary = summaryParts.join(' | ');

    const logEntry = {
        source: sourceName, 
        method: "APP_INPUT",
        path: "Frontend UI",
        status: 200,
        body: extracted, 
        summary: finalSummary 
    };
    
    const axios = require('axios');
    axios.post(WORKER_URL, logEntry).catch(() => {});
};

module.exports = {
    readProfiles,
    writeProfiles,
    createJobId,
    parseError,
    getValidAccessToken,
    makeApiCall,
    writeSaveFile,
    readSaveFile,
    listSaveFiles,
    logFrontendIntention // Export the logger
};