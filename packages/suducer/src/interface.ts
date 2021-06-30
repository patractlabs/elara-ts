import { IDT, RpcMapT, ChainConfig } from 'lib'
import Suducer
 from './suducer'

export enum ChainStat {
    Health  = 'health',
    Degrade = 'degrade',
    Fall    = 'fall',
}

interface Ext {
    extends: RpcMapT,
    excludes: string[]
}
export type ChainT = {[key in string]: ChainConfig}

export type ChainExtT = {[key: string]: Ext }

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
    id: string,
    topic: string,
    params: any[]
}

export interface CacheT {
    readonly syncAsBlock: string[],
    readonly syncOnce: string[]
}

export interface PubsubT {
    readonly sub: string[],
    readonly unsub: string[]
}