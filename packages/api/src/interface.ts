import Mom from 'moment'
import { IDT } from '@elara/lib'

export type Stats = Record<string, number | Record<string, number>>
export interface StatT {
    reqCnt: number,
    bw: number,
    wsConn: number,
    subCnt: number,
    subResCnt: number,
    delay: number,
    timeoutCnt: number,
    timeoutDelay: number,
    inReqCnt: number,
    ctMap: string,
}

export interface StatRedisT extends StatT {
    [key: string] : any
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
export type MomUnit = 'day' | 'hour' | 'minute' | 'second'