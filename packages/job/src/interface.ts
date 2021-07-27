import { IDT } from "@elara/lib";
import Http from 'http'
import Mom from 'moment'

export type Stat = Record<string, string|number>
export interface StatT {
    wsReqNum: number,
    wsConn: number,
    wsCt: string,   
    wsBw: number,
    wsDelay: number,
    wsInReqNum: number,
    wsTimeout: number,
    wsTimeoutCnt: number,

    httpReqNum: number,
    httpCt: string,
    httpBw: number,
    httpDelay: number,
    httpInReqNum: number,
    httpTimeout: number,
    httpTimeoutCnt: number,
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
    header?: Http.IncomingHttpHeaders,
    start: number,
    type?: string,       // noder kv cacher recorder
    delay?: number,      // ms
    bw?: number,         // bytes
    timeout?: boolean,   // timeout threshold 1s
    reqCnt?: number,     // for subscribe
}

export type StartT = Mom.unitOfTime.StartOf
export type DurationT = Mom.unitOfTime.DurationConstructor