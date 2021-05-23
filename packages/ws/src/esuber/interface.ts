import WebSocket from 'ws'
import { IDT } from 'lib'
import { randomId, md5 } from 'lib/utils'

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
    Sub = 'subscription',    // suscription
    Rpc = 'rpc-chanel',    // rpc channel
}

export interface Suber {
    ws: WebSocket,
    chain: string,
    url: string,
    id?: IDT,
    cluster?: number,    // 0 no-cluster, 1-N cluster ID
    chainId?: IDT,      // chain scale, hash(name, url)
    type?: SuberType,
    topic?: string,      // method
    stat?: SubStat,
    chainStat?: ChainStat,
    option?: any
}

export const newSuber = (
{ 
    chain, url, ws, 
    cluster = 0, 
    type = SuberType.Rpc,
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