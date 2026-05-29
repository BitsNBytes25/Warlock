"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusPoller = void 0;
const warlockClient_1 = require("../api/warlockClient");
const charts_1 = require("./charts");
class StatusPoller {
    postEmbedCallback;
    history = {};
    failures = {};
    lastStatus = {};
    lastPlayerCount = {};
    overrideStatus = {};
    client;
    constructor(postEmbedCallback) {
        this.postEmbedCallback = postEmbedCallback;
        this.client = new warlockClient_1.WarlockClient();
    }
    setOverrideStatus(gameName, status) {
        this.overrideStatus[gameName] = status;
        // Force an immediate update
        this.lastStatus[gameName] = '';
    }
    scheduleNextPoll(gameName, guid, serviceName, targetChannelId, baseIntervalMs) {
        let interval = baseIntervalMs;
        const failCount = this.failures[gameName] || 0;
        if (failCount > 0) {
            // Exponential backoff: base * 2^failures, capped at 1 hour (3600000 ms)
            interval = Math.min(baseIntervalMs * Math.pow(2, failCount - 1), 3600000);
            console.log(`[StatusPoller] API Unreachable. Backing off for ${gameName}. Next poll in ${interval / 1000}s`);
        }
        setTimeout(() => {
            this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId, baseIntervalMs);
        }, interval);
    }
    async pollAndBroadcast(gameName, guid, serviceName, targetChannelId, baseIntervalMs) {
        try {
            console.log(`[StatusPoller] Polling status for ${gameName}...`);
            const hostId = process.env.WARLOCK_TARGET_HOST || 'local';
            let stdout = '';
            let status = 'UNKNOWN';
            let isRecovering = false;
            try {
                const details = await this.client.getServiceDetails(guid, hostId, serviceName);
                if (details.service) {
                    status = details.service.status || 'ONLINE';
                    stdout = JSON.stringify(details.service, null, 2);
                }
                else {
                    status = details.status || 'ONLINE';
                    stdout = JSON.stringify(details, null, 2);
                }
                const prevFailures = this.failures[gameName] || 0;
                if (prevFailures > 0) {
                    isRecovering = true;
                    console.log(`[StatusPoller] Connection to Warlock restored for ${gameName}.`);
                }
                this.failures[gameName] = 0; // Reset failures
            }
            catch (err) {
                console.error('[StatusPoller] Caught error for', gameName, ':', err.message, err.stack);
                status = 'OFFLINE';
                stdout = `Error: ${err.message}`;
                this.failures[gameName] = (this.failures[gameName] || 0) + 1;
            }
            const failCount = this.failures[gameName] || 0;
            if (this.overrideStatus[gameName]) {
                status = this.overrideStatus[gameName];
            }
            // Build data for charts
            let playerCount = 0;
            if (status === 'running' || status === 'ONLINE') {
                const parsedDetails = JSON.parse(stdout);
                if (parsedDetails.player_count !== undefined) {
                    playerCount = parsedDetails.player_count;
                }
                else {
                    const playerMatch = stdout.match(/"players":\s*(\d+)/i);
                    if (playerMatch && playerMatch[1]) {
                        playerCount = parseInt(playerMatch[1], 10);
                    }
                }
            }
            if (!this.history[gameName]) {
                this.history[gameName] = [];
            }
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            const hist = this.history[gameName];
            if (hist) {
                hist.push({ time: timeStr, count: playerCount });
            }
            if (hist && hist.length > 15) {
                hist.shift();
            }
            // Determine if we should broadcast
            const justFailed = failCount === 1;
            const isOffline = failCount > 0;
            const statusChanged = this.lastStatus[gameName] !== status;
            const playersChanged = this.lastPlayerCount[gameName] !== playerCount;
            this.lastStatus[gameName] = status;
            this.lastPlayerCount[gameName] = playerCount;
            if (isOffline && !justFailed) {
                console.log(`[StatusPoller] Suppressing offline broadcast for ${gameName} to prevent channel spam.`);
            }
            else if (!statusChanged && !playersChanged) {
                console.log(`[StatusPoller] No changes for ${gameName}. Skipping broadcast to prevent spam.`);
            }
            else {
                const labels = (hist || []).map(h => h.time);
                const dataPoints = (hist || []).map(h => h.count);
                const chartUrl = charts_1.ChartGenerator.generatePlayerChart(labels, dataPoints, gameName);
                let titleStr = `🎮 ${gameName.toUpperCase()} Server Status`;
                if (justFailed)
                    titleStr += ` [API DISCONNECTED]`;
                if (isRecovering)
                    titleStr += ` [API RESTORED]`;
                let descriptionText = `**Status:** ${status === 'running' || status === 'ONLINE' ? '🟢 Online' : (status === 'OFFLINE' ? '🔴 Offline' : `🟡 ${status}`)}\n`;
                let embedFields = [];
                if (status === 'running' || status === 'ONLINE') {
                    try {
                        const data = JSON.parse(stdout);
                        const ipPort = data.ip ? `${data.ip}:${data.port || ''}` : 'Unknown';
                        const players = data.player_count !== undefined ? `${data.player_count}/${data.max_players || '?'}` : '0';
                        const memory = data.memory_usage ? (data.memory_usage > 1024 ? `${(data.memory_usage / 1024).toFixed(2)} GB` : `${data.memory_usage} MB`) : 'N/A';
                        const cpu = data.cpu_usage !== undefined ? `${data.cpu_usage}%` : 'N/A';
                        const responseTime = data.response_time || 'N/A';
                        embedFields = [
                            { name: '🔌 Connection', value: `\`${ipPort}\``, inline: true },
                            { name: '👥 Players', value: `\`${players}\``, inline: true },
                            { name: '⏱️ Ping', value: `\`${responseTime}\``, inline: true },
                            { name: '🧠 Memory', value: `\`${memory}\``, inline: true },
                            { name: '⚙️ CPU', value: `\`${cpu}\``, inline: true },
                            { name: '🎮 Server', value: `\`${data.name || gameName}\``, inline: true }
                        ];
                    }
                    catch (e) {
                        descriptionText += `\n**Raw Output:**\n\`\`\`text\n${stdout.substring(0, 500)}\n\`\`\``;
                    }
                }
                else {
                    descriptionText += `\n**Error Details:**\n\`\`\`text\n${stdout.substring(0, 500)}\n\`\`\``;
                }
                const embedPayload = {
                    embeds: [{
                            title: titleStr,
                            description: descriptionText,
                            fields: embedFields.length > 0 ? embedFields : undefined,
                            color: status === 'ONLINE' || status === 'running' ? 0x57F287 : 0xED4245,
                            image: { url: chartUrl },
                            footer: { text: 'Warlock Monitor' },
                            timestamp: new Date().toISOString()
                        }]
                };
                await this.postEmbedCallback(gameName, embedPayload);
            }
        }
        catch (err) {
            console.error(`[StatusPoller] Critical failure in poll loop for ${gameName}:`, err);
        }
        finally {
            // Always schedule the next poll
            this.scheduleNextPoll(gameName, guid, serviceName, targetChannelId, baseIntervalMs);
        }
    }
    startPolling(gameName, guid, serviceName, targetChannelId, intervalMs = 60000) {
        // Kick off the first poll
        this.pollAndBroadcast(gameName, guid, serviceName, targetChannelId, intervalMs);
    }
}
exports.StatusPoller = StatusPoller;
//# sourceMappingURL=statusPoller.js.map