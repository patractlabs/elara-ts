import { IDT } from "../../lib"

export type WsData = {
    id?: string,
    jsonrpc: string,
    method?: string,
    params?: any,
    error?: any,
    result?: any
}
export type ChainPidT = {
    chain: string,
    pid: IDT
}

// request cache
export enum ReqTyp {
    Sub,
    Unsub,
    Rpc,
    Close
}
export interface ReqT {
    id: IDT,
    chain: string,
    pid: IDT,
    pubId: IDT,
    subId: IDT,
    subsId?: string,
    originId: number,
    type: ReqTyp,
    jsonrpc: string,
    method: string,
    params: string
}