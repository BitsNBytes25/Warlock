export declare class WarlockClient {
    private baseUrl;
    private jar;
    private fetchWithCookies;
    private isAuthenticated;
    constructor();
    authenticate(): Promise<void>;
    private ensureAuthenticated;
    private getHeaders;
    private request;
    controlService(guid: string, host: string, service: string, action: string): Promise<any>;
    customCommand(guid: string, host: string, service: string, command: string): Promise<any>;
    getServiceDetails(guid: string, host: string, service: string): Promise<any>;
}
//# sourceMappingURL=warlockClient.d.ts.map