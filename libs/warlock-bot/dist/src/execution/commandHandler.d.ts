import { SchemaLoader } from '../schema/loader';
export declare class CommandHandler {
    private schemaLoader;
    private client;
    constructor(schemaLoader: SchemaLoader);
    /**
     * Parses and securely routes a command string like: !w windrose "kick SomePlayer"
     * @param messageContent The raw text from the Fluxer message
     */
    handleMessage(messageContent: string): Promise<string | null>;
}
//# sourceMappingURL=commandHandler.d.ts.map