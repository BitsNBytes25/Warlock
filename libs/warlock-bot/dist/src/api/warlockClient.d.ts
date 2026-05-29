export declare class WarlockClient {
    private baseUrl;
    private token;
    constructor();
    private getHeaders;
    /**
     * Sends a control command (start/stop/enable/disable)
     */
    controlService(guid: string, host: string, service: string, action: string): Promise<any>;
    /**
     * Sends a custom command to the service
     */
    customCommand(guid: string, host: string, service: string, command: string): Promise<string>;
    /**
     * Fetches service details (which includes status)
     */
    getServiceDetails(guid: string, host: string, service: string): Promise<any>;
}
//# sourceMappingURL=warlockClient.d.ts.map