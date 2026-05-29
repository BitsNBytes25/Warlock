"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusPoller = void 0;
const warlockClient_1 = require("../api/warlockClient");
const charts_1 = require("./charts");
class StatusPoller {
    postEmbedCallback;
    history = {};
    client;
    constructor(postEmbedCallback) {
        this.postEmbedCallback = postEmbedCallback;
        this.client = new warlockClient_1.WarlockClient();
    }
    async pollAndBroadcast(gameName, guid, serviceName, targetChannelId) {
        try {
            console.log(`[StatusPoller] Polling status for ${gameName}...`);
            const hostId = process.env.WARLOCK_TARGET_HOST || 'local';
            let stdout = '';
            let status = 'UNKNOWN';
            try {
                const details = await this.client.getServiceDetails(guid, hostId, serviceName);
                // Map Warlock API response to status text and player count
                status = details.status || 'ONLINE';
                stdout = JSON.stringify(details, null, 2);
            }
            catch (err) {
                // Fallback for development if API is unreachable
                status = 'OFFLINE';
                stdout = `Could not reach Warlock API.`;
            }
            // We attempt to extract a player count if the API exposes it, otherwise default to random for demo charting
            let playerCount = 0;
            const playerMatch = stdout.match(/"players":\s*(\d+)/i);
            if (playerMatch) {
                playerCount = parseInt(playerMatch[1], 10);
            }
            else {
                playerCount = Math.floor(Math.random() * 50); // Fallback metric
            }
            // Track history
            if (!this.history[gameName])
                this.history[gameName] = [];
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            this.history[gameName].push({ time: timeStr, count: playerCount });
            // Keep last 15 data points
            if (this.history[gameName].length > 15) {
                this.history[gameName].shift();
            }
            const labels = this.history[gameName].map(h => h.time);
            const dataPoints = this.history[gameName].map(h => h.count);
            const chartUrl = charts_1.ChartGenerator.generatePlayerChart(labels, dataPoints, gameName);
            // Build Fluxer rich embed
            const embedPayload = {
                embeds: [{
                        title: `🎮 ${gameName.toUpperCase()} Server Status`,
                        description: `**Status:** ${status}\n**Metrics:**\n\`\`\`json\n${stdout.substring(0, 1000)}\n\`\`\``,
                        color: status === 'ONLINE' ? 0x57F287 : 0xED4245,
                        image: {
                            url: chartUrl
                        },
                        footer: {
                            text: 'Warlock Monitor'
                        },
                        timestamp: new Date().toISOString()
                    }]
            };
            await this.postEmbedCallback(targetChannelId, embedPayload);
        }
        catch (err) {
            console.error(`[StatusPoller] Failed to poll ${gameName}:`, err);
        }
    }
    startPolling(gameName, guid, serviceName, targetChannelId, intervalMs = 60000) {
        this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId);
        setInterval(() => {
            this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId);
        }, intervalMs);
    }
}
exports.StatusPoller = StatusPoller;
//# sourceMappingURL=statusPoller.js.map