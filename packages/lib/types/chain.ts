import { RpcMapT } from './common-rpc'

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
    serverId: number,       // default 0, elara sever id bind
    excludes?: string[] | string,         // exclude rpc methods in basic rpcs
    extends?: RpcMapT | string,           // some special rpc method of chain
    [key: string]: any
}

export const toJsonstr = (chain: ChainConfig): string => {
    return JSON.stringify(chain)
}

export const toChain = (chain: string): ChainConfig => {
    return JSON.parse(chain)
}