import { RpcMapT } from 'lib'
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
    rpcPort?: number | string,   // default 9933
    wsPort?: number | string,    // default 9944
    excludes?: string[],         // exclude rpc methods in basic rpcs
    extends?: RpcMapT,               // some special rpc method of chain
}

export const newChain = (
    {name, baseUrl, rpcPort=9933, wsPort=9944, ...options}: ChainConfig)
    : ChainConfig => {

    return {
        name,
        baseUrl,
        rpcPort,
        wsPort,
        ...options
    }
}

export const toJsonstr = (chain: ChainConfig): string => {
    return JSON.stringify(chain)
}

export const toChain = (chain: string): ChainConfig => {
    return JSON.parse(chain)
}