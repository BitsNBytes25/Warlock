interface Platform {
    name: string;
    token: string;
    statusChannelId: string;
    isDiscord?: boolean;
}
export declare function editMessage(platform: Platform, channelId: string, messageId: string, payload: any): Promise<boolean>;
export declare function deleteMessage(platform: Platform, channelId: string, messageId: string): Promise<boolean>;
export {};
//# sourceMappingURL=index.d.ts.map