export declare class StatusPoller {
    private postEmbedCallback;
    private history;
    private client;
    constructor(postEmbedCallback: (channelId: string, embedPayload: any) => Promise<void>);
    pollAndBroadcast(gameName: string, guid: string, serviceName: string, targetChannelId: string): Promise<void>;
    startPolling(gameName: string, guid: string, serviceName: string, targetChannelId: string, intervalMs?: number): void;
}
//# sourceMappingURL=statusPoller.d.ts.map