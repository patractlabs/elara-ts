import WebSocket from 'ws'
import { IDT, getAppLogger, RpcMapT } from 'lib'
import { randomId, md5 } from 'lib/utils'

const log = getAppLogger('sube-i', true)

export enum SubStat {
    Active  = 'active',
    Check   = 'check',     
    Fail    = 'fail',
}

export enum ChainStat {
    Health  = 'health',
    Degrade = 'degrade',
    Fall    = 'fall',
}

export enum SuberType {
    Subscr = 'subscription',    // suscription
    Rpcchan = 'rpc-chanel',    // rpc channel
}

interface Ext {
    extends: RpcMapT,
    excludes: string[]
}

export type ChainExtT = {[key: string]: Ext }

export type ChainPoolT = { [key: string]: WsPool }

export interface Suber {
    ws: WebSocket,
    chain: string,
    url: string,        // host:port
    id?: IDT,
    cluster?: number,    // 0 no-cluster, 1-N cluster ID
    chainId?: IDT,      // chain scale, hash(name, url)
    type?: SuberType,
    subId?: IDT,           // unsubscribe params
    topic?: string,      // method
    stat?: SubStat,
    chainStat?: ChainStat,
    option?: any
}

export interface WsPool {
    sub: Suber[],
    chan: Suber[]
}

export const newSuber = ({ 
    chain, url, ws, 
    cluster = 0, 
    type = SuberType.Rpcchan,
    chainStat = ChainStat.Health,
    stat = SubStat.Active,
    ...options
}: Suber): Suber => {

    return {
        ...options,
        id: randomId(),
        chainId: md5(`${chain}${url}${cluster}`),
        cluster,
        ws,
        chain,
        url,
        type,
        stat,
        chainStat,
    }
}