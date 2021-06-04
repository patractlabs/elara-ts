import WebSocket from 'ws'
import { IDT } from 'lib'

export interface Suber {
    id: IDT,
    chain: string,
    url: string,
    ws: WebSocket,
}

export interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket
}

export interface SubscripT {
    id?: string,
    pubId: IDT,
    topic: string,
    params: string
}

export type SubscripMap = {[key in string]: SubscripT}

export interface MatcherT {
    pubId?: IDT,
    subId?: IDT,
    pid?: IDT,
    originId?: IDT,          
    chain?: string,
    subscribe?: string[],   //  topic : SubscripT
}

export interface WsData {
    id?: IDT,
    jsonrpc: string,
    method?: string,
    result?: any,
    params?: any
}

export type SuberMap = { [key in IDT]: Suber }
export type ChainSuber = { [key in string]: SuberMap }   
export type PuberMap = { [key in IDT]: Puber }
export type Matcher = { [key in string]: IDT }