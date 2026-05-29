export declare class StatusPoller {
    private postEmbedCallback;
    private history;
    private failures;
    private lastStatus;
    private lastPlayerCount;
    private overrideStatus;
    private client;
    constructor(postEmbedCallback: (gameName: string, embedPayload: any) => Promise<void>);
    setOverrideStatus(gameName: string, status: string | null): void;
    private scheduleNextPoll;
    pollAndBroadcast(gameName: string, guid: string, serviceName: string, targetChannelId: string, baseIntervalMs: number): Promise<void>;
    startPolling(gameName: string, guid: string, serviceName: string, targetChannelId: string, intervalMs?: number): void;
}
//# sourceMappingURL=statusPoller.d.ts.map