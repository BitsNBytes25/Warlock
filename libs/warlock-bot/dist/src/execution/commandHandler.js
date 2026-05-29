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
    /**
     * Parses and securely routes a command string like: !w windrose "kick SomePlayer"
     * @param messageContent The raw text from the Fluxer message
     */
    async handleMessage(messageContent) {
        const prefix = '!w ';
        if (!messageContent.startsWith(prefix))
            return null;
        const body = messageContent.slice(prefix.length).trim();
        // Parse: <game_name> "<api_command> [arguments]"
        const match = body.match(/^(\w+)\s+"([^"]+)"$/);
        if (!match) {
            return '❌ Invalid syntax. Use: `!w <game_name> "<command> [args]"`';
        }
        const gameName = match[1];
        const payload = match[2].trim();
        // Split payload into command and args
        const parts = payload.split(' ');
        const apiCommand = parts[0];
        const args = parts.slice(1).join(' ');
        const schema = this.schemaLoader.getSchema();
        if (!schema[gameName]) {
            return `❌ Game \`${gameName}\` is not registered in the Warlock config.`;
        }
        const gameSchema = schema[gameName];
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
                await this.client.controlService(guid, hostId, serviceName, gameDef.action);
                return `✅ **Success:** Sent \`${gameDef.action}\` command to ${gameName}.`;
            }
            else if (gameDef.type === 'custom') {
                const cmdStr = gameDef.command.replace('{args}', args);
                const result = await this.client.customCommand(guid, hostId, serviceName, cmdStr);
                let response = `✅ **Execution Success for \`${gameName} ${apiCommand}\`**\n\`\`\`text\n`;
                response += result.trim() ? result.trim() : 'Command executed.';
                response += '\n```';
                return response;
            }
            return `❌ Unknown command type in schema.`;
        }
        catch (e) {
            return `❌ **Execution Failed**\n\`\`\`text\n${e.message}\n\`\`\``;
        }
    }
}
exports.CommandHandler = CommandHandler;
//# sourceMappingURL=commandHandler.js.map