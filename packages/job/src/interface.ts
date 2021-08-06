import { IDT } from "@elara/lib";
import Mom from 'moment'

export type Stats = Record<string, string | number>
export interface StatT {
    wsReqNum: number,
    wsConn: number,
    wsCt: string,
    wsSubNum: number,
    wsSubResNum: number,
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
    header: Header,
    start: number,
    type?: string,       // noder kv cacher recorder
    delay?: number,      // ms
    bw?: number,         // bytes
    timeout?: boolean,   // timeout threshold 1s
    reqCnt?: number,     // for subscribe
}

enum ProStatus {
    Active = 'active',
    Stop = 'stop',
    Suspend = 'suspend'
}

enum Network {
    Live = 'live',
    Test = 'test',
    Polkadot = 'polkadot',
    Kusama = 'kusama',
    Westend = 'westend',
    Rococo = 'rococo'
}

export interface ProAttr {
    id: number,
    pid: string,
    name: string,
    status: ProStatus,
    userId: number            // user id
    secret: string
    chain: string,
    team: string,
    network: Network,
    reqSecLimit: number,
    reqDayLimit: number,
    bwDayLimit: number
}

enum UserStat {
    Active = "active",
    Suspend = "suspend", // update 00:00 o'clock
    Barred = "barred", // account abandon
}

enum UserLevel {
    Normal = "normal",
    Bronze = "bronzer",
    Silver = "silver",
    Golden = "gold",
}

enum LoginType {
    Github = "github",
    Phone = "phone",
    Mail = "mail",
}

export interface UserAttr {
    id: number;
    name: string;
    status: UserStat;
    levelId: number;
    level: UserLevel;
    loginType: LoginType;
    githubId?: string;
    phone?: string;
    mail?: string;
}

export type StartT = Mom.unitOfTime.StartOf
export type DurationT = Mom.unitOfTime.DurationConstructor
export type MomUnit = 'day' | 'hour' | 'minute' | 'second'