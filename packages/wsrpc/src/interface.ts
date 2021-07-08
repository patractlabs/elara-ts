import { IDT } from "lib"
import Suber, { SuberTyp } from './matcher/suber'

export type ReqDataT = {
    id: string,
    jsonrpc: string,
    method: string,
    params: any[]
}

export type WsData = {
    id?: string,
    jsonrpc: string,
    method?: string,
    params?: any,
    error?: any,
    result?: any,
    data?: any
}
export type ChainPidT = {
    chain: string,
    pid: IDT
}

// request cache
export enum ReqTyp {
    Sub     = 'sub',
    Unsub   = 'unsub',
    Rpc     = 'rpc',
    Close   = 'close'
}
export interface ReqT {
    id: IDT,
    chain: string,
    pid: IDT,
    pubId: IDT,
    subType: SuberTyp,
    subId: IDT,
    subsId?: string,
    originId: IDT,
    type: ReqTyp,
    jsonrpc: string,
    method: string,
    params: string
}

export interface SubscripT {
    id: string,
    pubId: IDT,
    method: string,
    params: string
}

export interface CacheResultT {
    result: any,
    updateTime: number
}

export type SuberMap = { [key in IDT]: Suber }
export type ChainSuber = { [key in string]: SuberMap } 