import Mom from 'moment'
import { IDT } from '@elara/lib'

export type Stats = Record<string, number | Record<string, number>>
export interface StatT {
    wsReqNum: number,
    wsConn: number,
    wsCt: Record<string, number>,
    wsBw: number,
    wsDelay: number,
    wsInReqNum: number,
    wsTimeout: number,
    wsTimeoutCnt: number,

    httpReqNum: number,
    httpCt: Record<string, number>,
    httpBw: number,
    httpDelay: number,
    httpInReqNum: number,
    httpTimeout: number,
    httpTimeoutCnt: number,
}

interface Header {
    origin: string,
    agent: string,
    ip: string,
}

export interface ReqDataT {
    id: IDT,
    jsonrpc: string,
    method: string,
    params?: any[]
}

export interface Statistics {
    proto: string,   // http ws
    chain: string,
    pid: string,
    method: string,
    req: ReqDataT,
    reqtime: number,     // request start time
    code: number,        // 200 400 500
    header: Header,
    start: number,
    type?: string,       // noder kv cacher recorder
    delay?: number,      // ms
    bw?: number,         // bytes
    timeout?: boolean,   // timeout threshold 1s
    reqCnt?: number,     // for subscribe
}

export type StartT = Mom.unitOfTime.StartOf
export type DurationT = Mom.unitOfTime.DurationConstructor