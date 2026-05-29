"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const loader_1 = require("./schema/loader");
const commandHandler_1 = require("./execution/commandHandler");
const statusPoller_1 = require("./monitoring/statusPoller");
const ws_1 = __importDefault(require("ws"));
dotenv.config();
const FLUXER_API_BASE = 'https://api.fluxer.app/v1';
const TOKEN = process.env.FLUXER_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHANNEL_ID = process.env.STATUS_CHANNEL_ID || '1234567890'; // Target channel for status updates
console.log('[App] Starting Fluxer Bot for Warlock...');
// 1. Load the dynamic route configuration
const schemaPath = path.join(__dirname, '..', 'game_commands.json');
const schemaLoader = new loader_1.SchemaLoader(schemaPath);
schemaLoader.load();
// 2. Initialize the Command Handler
const commandHandler = new commandHandler_1.CommandHandler(schemaLoader);
// Helper function to send messages to Fluxer via REST
async function sendMessage(channelId, payload) {
    try {
        const res = await fetch(`${FLUXER_API_BASE}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`[API] Failed to send message: ${res.status} ${errText}`);
        }
        else {
            console.log(`[API] Message sent successfully to ${channelId}.`);
        }
    }
    catch (error) {
        console.error(`[API] Error sending message:`, error);
    }
}
// 3. Start the Status Poller
const poller = new statusPoller_1.StatusPoller(async (channelId, embedPayload) => {
    await sendMessage(channelId, embedPayload);
});
// We simulate polling for Windrose every 60 seconds.
const schema = schemaLoader.getSchema();
if (schema['windrose']) {
    poller.startPolling('windrose', schema['windrose'].guid, schema['windrose'].service_name, CHANNEL_ID, 60000);
}
// 4. Connect to Fluxer WebSocket Gateway (mock endpoint conceptually based on docs)
// Since Fluxer Gateway is modeled after Discord, it usually requires sending IDENTIFY.
// We'll write a conceptual WebSocket wrapper here.
function connectGateway() {
    // Using a mock gateway URL for this example since we don't have the exact gateway path
    const wsUrl = 'wss://gateway.fluxer.app/?v=1&encoding=json';
    let ws;
    try {
        ws = new ws_1.default(wsUrl);
    }
    catch (err) {
        console.log('[Gateway] Cannot connect to mock WSS endpoint, continuing in standalone mode.');
        return;
    }
    ws.on('open', () => {
        console.log('[Gateway] Connected to Fluxer WebSocket.');
        const identifyPayload = {
            op: 2,
            d: {
                token: TOKEN,
                intents: 513, // Guilds + Guild Messages (conceptual)
                properties: {
                    $os: process.platform,
                    $browser: 'WarlockBot',
                    $device: 'WarlockBot'
                }
            }
        };
        ws.send(JSON.stringify(identifyPayload));
    });
    ws.on('message', async (data) => {
        try {
            const payload = JSON.parse(data.toString());
            // Handle heartbeats and acks conceptually...
            if (payload.op === 10) {
                // Hello event, start heartbeat
                const heartbeatInterval = payload.d.heartbeat_interval;
                setInterval(() => {
                    ws.send(JSON.stringify({ op: 1, d: null }));
                }, heartbeatInterval);
            }
            // Handle message create events
            if (payload.t === 'MESSAGE_CREATE') {
                const message = payload.d;
                // Ignore bot messages
                if (message.author?.bot)
                    return;
                // Process command
                const responseText = await commandHandler.handleMessage(message.content);
                if (responseText) {
                    await sendMessage(message.channel_id, { content: responseText });
                }
            }
        }
        catch (err) {
            console.error('[Gateway] Message processing error:', err);
        }
    });
    ws.on('close', () => {
        console.log('[Gateway] Connection closed. Reconnecting in 5s...');
        setTimeout(connectGateway, 5000);
    });
    ws.on('error', (err) => {
        // Expected to error out since gateway.fluxer.app is a mock
        console.log('[Gateway] Connection error (mock gateway).');
    });
}
connectGateway();
console.log('[App] Bot successfully initialized.');
//# sourceMappingURL=index.js.map