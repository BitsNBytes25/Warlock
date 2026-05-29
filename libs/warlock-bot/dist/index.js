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
Object.defineProperty(exports, "__esModule", { value: true });
exports.editMessage = editMessage;
exports.deleteMessage = deleteMessage;
const dotenv = __importStar(require("dotenv"));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const buffer_1 = require("buffer");
if (!globalThis.File) {
    globalThis.File = buffer_1.File;
}
const path = __importStar(require("path"));
const loader_1 = require("./schema/loader");
const commandHandler_1 = require("./execution/commandHandler");
const statusPoller_1 = require("./monitoring/statusPoller");
const core_1 = require("@discordjs/core");
const rest_1 = require("@discordjs/rest");
const ws_1 = require("@discordjs/ws");
dotenv.config();
console.log('[App] Starting Bot for Warlock...');
// 1. Load the dynamic route configuration
const schemaPath = path.join(__dirname, '..', 'game_commands.json');
const schemaLoader = new loader_1.SchemaLoader(schemaPath);
schemaLoader.load();
// 2. Initialize the Command Handler
const commandHandler = new commandHandler_1.CommandHandler(schemaLoader);
const platforms = [];
if (process.env.FLUXER_TOKEN) {
    platforms.push({
        name: 'Fluxer',
        token: process.env.FLUXER_TOKEN,
        statusChannelId: process.env.STATUS_CHANNEL_ID || ''
    });
}
if (process.env.DISCORD_TOKEN) {
    platforms.push({
        name: 'Discord',
        token: process.env.DISCORD_TOKEN,
        statusChannelId: process.env.DISCORD_STATUS_CHANNEL_ID || '',
        isDiscord: true
    });
}
const fs = __importStar(require("fs"));
// Helper functions to send/edit/delete messages via REST
async function sendMessage(platform, channelId, payload) {
    try {
        const url = platform.isDiscord
            ? `https://discord.com/api/v10/channels/${channelId}/messages`
            : `https://api.fluxer.app/v1/channels/${channelId}/messages`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${platform.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            console.error(`[${platform.name} API] Failed to send message: ${res.status} ${await res.text()}`);
            return undefined;
        }
        const data = await res.json();
        return data.id;
    }
    catch (error) {
        console.error(`[${platform.name} API] Error sending message:`, error);
    }
}
async function editMessage(platform, channelId, messageId, payload) {
    try {
        const url = platform.isDiscord
            ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
            : `https://api.fluxer.app/v1/channels/${channelId}/messages/${messageId}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bot ${platform.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return res.ok;
    }
    catch (error) {
        return false;
    }
}
async function deleteMessage(platform, channelId, messageId) {
    try {
        const url = platform.isDiscord
            ? `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
            : `https://api.fluxer.app/v1/channels/${channelId}/messages/${messageId}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bot ${platform.token}` }
        });
        return res.ok;
    }
    catch (error) {
        return false;
    }
}
// State management for persistent status messages
const stateFile = path.join(__dirname, '..', 'data', 'state.json');
let messageState = {};
try {
    if (fs.existsSync(stateFile)) {
        messageState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
}
catch (e) {
    console.log('[App] No previous state found or invalid state.');
}
function saveState() {
    try {
        const dir = path.dirname(stateFile);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(stateFile, JSON.stringify(messageState, null, 2));
    }
    catch (e) {
        console.error('[App] Failed to save state:', e);
    }
}
// 3. Start the Status Poller
const poller = new statusPoller_1.StatusPoller(async (gameName, embedPayload) => {
    if (!messageState[gameName])
        messageState[gameName] = {};
    for (const p of platforms) {
        if (!p.statusChannelId)
            continue;
        const existingMessageId = messageState[gameName][p.name];
        let success = false;
        if (existingMessageId) {
            success = await editMessage(p, p.statusChannelId, existingMessageId, embedPayload);
        }
        if (!success) {
            // Send a new message if editing failed or we don't have one
            const newId = await sendMessage(p, p.statusChannelId, embedPayload);
            if (newId) {
                messageState[gameName][p.name] = newId;
                saveState();
            }
        }
    }
});
// Start polling for all loaded game configurations
const schema = schemaLoader.getSchema();
for (const gameName in schema) {
    const gameConfig = schema[gameName];
    if (gameConfig) {
        poller.startPolling(gameName, gameConfig.guid, gameConfig.service_name, 'ignored', 30000); // Poll every 30s
    }
}
function connectGateway(platform) {
    const restOptions = { version: platform.isDiscord ? '10' : '1' };
    if (!platform.isDiscord) {
        restOptions.api = 'https://api.fluxer.app';
    }
    const rest = new rest_1.REST(restOptions).setToken(platform.token);
    const gateway = new ws_1.WebSocketManager({
        intents: platform.isDiscord ? (core_1.GatewayIntentBits.Guilds | core_1.GatewayIntentBits.GuildMessages | core_1.GatewayIntentBits.MessageContent) : 0,
        rest,
        token: platform.token,
        version: platform.isDiscord ? '10' : '1',
    });
    const client = new core_1.Client({ rest, gateway });
    client.on(core_1.GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
        try {
            if (message.author?.bot)
                return;
            const adminRoleId = platform.isDiscord ? process.env.DISCORD_ADMIN_ROLE_ID : process.env.ADMIN_ROLE_ID;
            if (message.content.startsWith('!w ') && adminRoleId) {
                const hasRole = message.member?.roles?.includes(adminRoleId);
                if (!hasRole) {
                    await sendMessage(platform, message.channel_id, { content: '❌ You do not have permission to execute Warlock commands.' });
                    return;
                }
            }
            // Instead of just passing a string, we want the CommandHandler to be able to send, edit, and delete replies, and override poller status
            const responseText = await commandHandler.handleMessage(message.content, {
                reply: async (payload) => {
                    const id = await sendMessage(platform, message.channel_id, payload);
                    return id;
                },
                editReply: async (messageId, payload) => {
                    await editMessage(platform, message.channel_id, messageId, payload);
                },
                deleteReply: async (messageId) => {
                    await deleteMessage(platform, message.channel_id, messageId);
                }
            }, poller);
            if (responseText) {
                await sendMessage(platform, message.channel_id, { content: responseText });
            }
        }
        catch (err) {
            console.error(`[${platform.name} Gateway] Message processing error:`, err);
        }
    });
    client.on(core_1.GatewayDispatchEvents.Ready, ({ data }) => {
        console.log(`[${platform.name} Gateway] Ready as @${data.user.username}#${data.user.discriminator ?? '0000'}.`);
    });
    gateway.connect();
}
if (platforms.length === 0) {
    console.warn('[App] No platform tokens provided! Please set FLUXER_TOKEN or DISCORD_TOKEN in .env.');
}
for (const p of platforms) {
    connectGateway(p);
}
console.log('[App] Bot successfully initialized.');
//# sourceMappingURL=index.js.map