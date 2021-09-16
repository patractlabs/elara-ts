import { IDT } from '@elara/lib'
import Suber from './matcher/suber'
import { NodeType } from './chain'

type SuberTyp = NodeType

export interface ReqDataT {
    id: IDT,
    jsonrpc: string,
    method: string,
    params?: any[]
}

type wsErrT = {
    code: number,
    message: string,
    data?: any
}

export interface WsData extends ReqDataT {
    params?: any,
    error?: wsErrT,
    result?: any,
    data?: any
}

export type ChainPidT = {
    chain: string,
    pid: IDT
}

// request cache
export enum ReqTyp {
    Sub = 'sub',
    Unsub = 'unsub',
    Rpc = 'rpc',
    Close = 'close'
}

export interface ReqT {
    id: string,
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
    params: any,
    stat: Statistics,
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

export enum CloseReason {
    Node = 'node service unavailable',
    Kv = 'kv service unavailable',
    OutOfLimit = 'out of connect limit',
    SuberUnavail = 'suber unavailable'
}

interface Header {
    origin: string,
    agent: string,
    ip: string,
}

export interface Statistics {
    proto: string,   // http ws
    chain: string,
    pid: string,
    method: string,
    req: ReqDataT,
    reqtime: number,     // request start time
    code: number,        // 200 400 500
    header?: Header,
    start: number,
    type?: string,       // noder kv cacher recorder
    delay?: number,      // ms
    bw?: number,         // bytes
    timeout?: boolean,   // timeout threshold 1s
    reqCnt?: number,     // for subscribe
}

export interface PingT {
    id: string,
    startTime: number
}