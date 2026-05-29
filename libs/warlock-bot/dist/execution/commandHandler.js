"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
const warlockClient_1 = require("../api/warlockClient");
class CommandHandler {
    schemaLoader;
    client;
    constructor(schemaLoader) {
        this.schemaLoader = schemaLoader;
        this.client = new warlockClient_1.WarlockClient();
    }
    async handleMessage(messageContent, callbacks, poller) {
        const prefix = '!w ';
        if (!messageContent.startsWith(prefix))
            return null;
        const body = messageContent.slice(prefix.length).trim();
        // Parse: <game_name> <api_command> [arguments]
        const parts = body.split(' ');
        if (parts.length < 2) {
            return '❌ Invalid syntax. Use: `!w <game_name> <command> [args]`';
        }
        const gameName = parts[0];
        const apiCommand = parts[1];
        const args = parts.slice(2).join(' ');
        const schema = this.schemaLoader.getSchema();
        if (!schema[gameName]) {
            return `❌ Game \`${gameName}\` is not registered in the Warlock config.`;
        }
        const gameSchema = schema[gameName];
        if (!gameSchema) {
            return `❌ Game \`${gameName}\` is not properly configured.`;
        }
        const gameDef = gameSchema.commands[apiCommand];
        if (!gameDef) {
            return `❌ Command \`${apiCommand}\` is not registered for \`${gameName}\`.`;
        }
        if (gameDef.requires_args && !args) {
            return `❌ Command \`${apiCommand}\` requires arguments.`;
        }
        if (gameDef.requires_args && gameDef.args_regex) {
            const regex = new RegExp(gameDef.args_regex);
            if (!regex.test(args)) {
                return `❌ Invalid arguments provided for \`${apiCommand}\`. Failed security validation.`;
            }
        }
        const guid = gameSchema.guid;
        const serviceName = gameSchema.service_name;
        const hostId = process.env.WARLOCK_TARGET_HOST || 'local'; // Using a designated host ID
        try {
            if (gameDef.type === 'control') {
                const action = gameDef.action;
                if (callbacks && poller && (action === 'start' || action === 'stop')) {
                    const overrideState = action === 'start' ? 'Starting...' : 'Stopping...';
                    poller.setOverrideStatus(gameName, overrideState);
                    const msgId = await callbacks.reply({ content: `⏳ Server is ${action}ing...` });
                    await this.client.controlService(guid, hostId, serviceName, action);
                    if (msgId) {
                        // Poll briefly to wait for status to update
                        const targetStatus = action === 'start' ? 'running' : 'stopped';
                        let reachedTarget = false;
                        for (let i = 0; i < 15; i++) { // Poll 15 times (30s)
                            await new Promise(r => setTimeout(r, 2000));
                            try {
                                const details = await this.client.getServiceDetails(guid, hostId, serviceName);
                                const currentStatus = details.service ? details.service.status : details.status;
                                if (currentStatus === targetStatus || (targetStatus === 'running' && currentStatus === 'ONLINE') || (targetStatus === 'stopped' && currentStatus === 'OFFLINE')) {
                                    reachedTarget = true;
                                    break;
                                }
                            }
                            catch (e) {
                                if (targetStatus === 'stopped') {
                                    reachedTarget = true; // Error usually means it's offline
                                    break;
                                }
                            }
                        }
                        poller.setOverrideStatus(gameName, null);
                        if (reachedTarget) {
                            await callbacks.editReply(msgId, { content: `✅ Server is ${action === 'start' ? 'started' : 'stopped'}!` });
                        }
                        else {
                            await callbacks.editReply(msgId, { content: `⚠️ Command sent, but timed out waiting for status confirmation.` });
                        }
                        setTimeout(() => callbacks.deleteReply(msgId), 7000);
                    }
                    return null; // Don't return standard response since we handled it
                }
                await this.client.controlService(guid, hostId, serviceName, action);
                return `✅ **Success:** Sent \`${action}\` command to ${gameName}.`;
            }
            else if (gameDef.type === 'custom') {
                const commandTemplate = gameDef.command;
                const cmdStr = commandTemplate.replace('{args}', args);
                const result = await this.client.customCommand(guid, hostId, serviceName, cmdStr);
                let response = `✅ **Execution Success for \`${gameName} ${apiCommand}\`**\n\`\`\`text\n`;
                response += result.trim() ? result.trim() : 'Command executed.';
                response += '\n```';
                return response;
            }
            return `❌ Unknown command type in schema.`;
        }
        catch (e) {
            if (poller)
                poller.setOverrideStatus(gameName, null);
            return `❌ **Execution Failed**\n\`\`\`text\n${e.message}\n\`\`\``;
        }
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=commandHandler.js.map