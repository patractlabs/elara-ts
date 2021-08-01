

export interface ChainConfig {
    id: number,
    serverId: number,       // default 0, elara sever id bind
    baseUrl: string,        // host:port
    rpcPort: number,       // default 9933
    wsPort: number,        // default 9944
    kvEnable: boolean,      // default false
    kvBaseUrl?: string,
    kvPort?: number,
}