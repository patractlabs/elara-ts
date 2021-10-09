import { IDT } from '@elara/lib'
import Suducer from './suducer'
import { ChainConfig } from './chain'

export enum ChainStat {
    Health  = 'health',
    Degrade = 'degrade',
    Fall    = 'fall',
}

export type ChainT = {[key in string]: ChainConfig}

export type ChainPoolT = { [key: string]: WsPool }

export type SuducerPool = {[key in string]: Suducer | string }

export type SuducersT = {[key in string]: Suducer }

export type SuducerMap = {[key in string]: SuducersT}

export interface WsPool {
    sub?: SuducerPool,
    cache?: SuducerPool,
    reqresp?: SuducerPool,
    history?: SuducerPool,
}

export interface SubProto {
    chain: string,
    topic: string,
    subId: IDT,
    data: any,
}

export type TopicT = {
    id?: string,
    topic: string,
    params: any[]
}

export enum CacheStrategyT {
    SyncAsBlock = 'SyncAsBlock',
    SyncOnce = 'SyncOnce',
    SyncLow = 'SyncLow'
}

export enum PsubStrategyT {
    Sub = 'Sub',
    Unsub = 'Unsub'
}

export type CacheT = {
    [key in CacheStrategyT]: string[]
}

export type PubsubT = {
    [key in PsubStrategyT]: string[]
}

export interface ReqT {
    id: string,
    jsonrpc: string,
    method: string,
    params: any[]
}