import { IDT } from 'lib'
import Suber from './suber'
import Puber from './puber'


export type SuberMap = { [key in IDT]: Suber }
export type ChainSuber = { [key in string]: SuberMap } 

export type PuberMap = { [key in IDT]: Puber }

export enum ReqTyp {
    Sub,
    Unsub,
    Rpc,
    Close
}

// request type 
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

export type ReqMap = {[key in string]: ReqT}

// subscribe type
export interface SubscripT {
    id: string,
    pubId: IDT,
    method: string,
    params: string
}

export type SubscripMap = {[key in string]: SubscripT}

export interface WsData {
    id?: IDT,
    jsonrpc: string,
    method?: string,
    result?: any,
    params?: any,
    error?: any
}

export type ChainPidT = {
    chain: string,
    pid: IDT
}