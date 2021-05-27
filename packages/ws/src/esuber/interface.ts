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
    Sub = 'sub',    // suscription
    Chan = 'chan',    // rpc channel
}

interface Ext {
    extends: RpcMapT,
    excludes: string[]
}

export type ChainExtT = {[key: string]: Ext }

export type ChainPoolT = { [key: string]: WsPool }

export interface Suber {
    id?: IDT,
    ws: WebSocket,
    chainId?: IDT,      // chain scale, hash(name, url)
    chain: string,
    url: string,        // host:port
    cluster?: number,    // 0 no-cluster, 1-N cluster ID
    type: SuberType,
    subId?: IDT,           // unsubscribe params
    topic?: string,      // method
    stat?: SubStat,
    chainStat?: ChainStat,
    option?: any
}
export type SuberPool = {[key in string]: Suber}
export interface WsPool {
    sub?: SuberPool,
    chan?: SuberPool
}

export const newSuber = ({ 
    ...options
}: Suber): Suber => {
    
    const chain: string = options.chain || ''
    const url = options.url || 'ws://localhost:80'
    const ws = options.ws 
    const cluster = options.cluster || 0
    const type = options.type || SuberType.Chan
    const stat = options.stat || SubStat.Check
    const chainStat = options.chainStat || ChainStat.Degrade
    const subId = options.subId || ''
    const topic = options.topic || ''

    return {
        id: randomId(),
        chainId: md5(`${chain}${url}${cluster}`),
        cluster,
        ws,
        chain,
        url,
        subId,
        topic,
        type,
        stat,
        chainStat,
    }
}