export enum Network {
    Live = 'live',
    Test = 'test',
}

export enum ChainType {
    Relay = 'relay',
    Parallel = 'parallel'
}

export interface ChainConfig {
    name: string,
    baseUrl: string,
    network?: Network,
    chainType?: ChainType,
    rpcPort: number,       // default 9933
    wsPort: number,        // default 9944
    kvPort?: number,
    kvEnable: boolean,      // default false
    kvBaseUrl?: string,
    serverId: number,       // default 0, elara sever id bind
    [key: string]: any
}