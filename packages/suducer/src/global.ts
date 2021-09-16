import EventEmitter from 'events'
import { getAppLogger, IDT } from '@elara/lib'
import { None, Some, Option } from '@elara/lib'
import { CacheT, ChainT, SuducerMap, SuducersT, PubsubT, CacheStrategyT, PsubStrategyT } from './interface'
import Suducer, { SuducerT } from './suducer'
import { ChainConfig } from './chain'

const log = getAppLogger('global')

const Intervals: { [key in string]: NodeJS.Timeout } = {}

const Caches: CacheT = {
    SyncAsBlock: [
        "system_syncState",
        "system_health",
        "chain_getHeader",
        "chain_getBlock",
        "chain_getBlockHash",
        "chain_getFinalizedHead"
    ],
    SyncOnce: [
        "rpc_methods",
        "system_name",
        "system_version",
        "system_chain",
        "system_chainType",
        "system_properties",
        "state_getMetadata",
        "state_getRuntimeVersion"
    ],
    SyncLow: []
}
const Pubsubs: PubsubT = {
    Sub: [
        "state_subscribeRuntimeVersion",
    ],
    Unsub: [
        "state_unsubscribeRuntimeVersion",
    ]
}

const Extrinsics: PubsubT = {
    Sub: ["author_submitAndWatchExtrinsic"],
    Unsub: ["author_unwatchExtrinsic"]
}
type StringMapT = { [key in string]: string }
const Submap: StringMapT = {
    "chain_allHead": "chain_subscribeAllHeads",
    "chain_newHead": "chain_subscribeNewHeads",
    "chain_finalizedHead": "chain_subscribeFinalizedHeads",

    "state_runtimeVersion": "state_subscribeRuntimeVersion",
    "state_storage": "state_subscribeStorage",

    "grandpa_justifications": "grandpa_subscribeJustifications",

    "author_extrinsicUpdate": "author_submitAndWatchExtrinsic"
}

const Chains: ChainT = {}
const Suducers: SuducerMap = {}

type TopicMapT = { [key in string]: IDT }
const TopicSudidMap: { [key in string]: TopicMapT } = {}

const PoolCnt: { [key in string]: number } = {}
const PoolEvt: { [key in string]: EventEmitter } = {}

// requestId -- method
const SubCache: { [key in string]: string } = {}

export class G {
    // pool count
    static setPoolCnt(chain: string, type: SuducerT, cnt: number) {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] = cnt
    }

    static getPoolCnt(chain: string, type: SuducerT): number {
        const key = `${chain.toLowerCase()}-${type}`
        return PoolCnt[key]
    }

    static incrPoolCnt(chain: string, type: SuducerT): void {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] += 1
    }

    static decrPoolCnt(chain: string, type: SuducerT): void {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] -= 1
    }

    // pool event
    static setPoolEvt(type: SuducerT, evt: EventEmitter) {
        PoolEvt[type] = evt
    }

    static delPoolEvt(type: SuducerT) {
        delete PoolEvt[type]
    }

    static getPoolEvt(type: SuducerT): EventEmitter {
        return PoolEvt[type]
    }

    static getAllPoolEvt() {
        return PoolEvt
    }

    // strategy 
    static getCacheMap(): CacheT {
        return Caches
    }

    static getCacheByType(type: CacheStrategyT): string[] {
        return Caches[type]
    }

    static getPubsubMap(): PubsubT {
        return Pubsubs
    }

    static getSubTopics(): string[] {
        return Pubsubs[PsubStrategyT.Sub]
    }

    static getUnsubTopics(): string[] {
        return Pubsubs[PsubStrategyT.Unsub]
    }

    static getExtrinMap(): PubsubT {
        return Extrinsics
    }

    static getSubMaps(): StringMapT {
        return Submap
    }

    static getSubMethod(method: string): Option<string> {
        if (!Submap[method]) { return None }
        return Some(Submap[method])
    }

    // chain config op
    static addChain(chain: ChainConfig): void {
        const key = `${chain.name.toLowerCase()}-${chain.nodeId}`
        Chains[key] = chain
    }

    static updateChain(chain: ChainConfig): void {
        Chains[`${chain.name.toLowerCase()}-${chain.nodeId}`] = chain
    }

    static getChain(chain: string, nodeId: number): Option<ChainConfig> {
        const key = `${chain.toLowerCase()}-${nodeId}`
        if (!Chains[key]) {
            return None
        }
        return Some(Chains[key])
    }

    static delChain(chain: string, nodeId: number): void {
        delete Chains[`${chain.toLowerCase()}-${nodeId}`]
    }

    static getAllChains(): Option<string[]> {
        if (Chains == {}) {
            return None
        }
        return Some(Object.keys(Chains))
    }

    static getAllChainConfs(): Option<ChainT> {
        if (Chains == {}) {
            return None
        }
        return Some(Chains)
    }

    // intervals 
    static addInterval(chain: string, strategy: CacheStrategyT, interval: NodeJS.Timeout) {
        const key = `${chain.toLowerCase()}-${strategy}`
        if (Intervals[key]) {
            log.error(`add interval error: ${key} exist`)
            return
        }
        Intervals[key] = interval
    }

    static delInterval(chain: string, strategy: CacheStrategyT) {
        delete Intervals[`${chain.toLowerCase()}-${strategy}`]
    }

    // suducer 
    static addSuducer(suducer: Suducer): void {
        const key = `${suducer.chain.toLowerCase()}-${suducer.type}`
        Suducers[key] = Suducers[key] || {}
        Suducers[key][suducer.id!] = suducer
    }

    static getSuducer(chain: string, typ: SuducerT, sudId: IDT): Option<Suducer> {
        const key = `${chain.toLowerCase()}-${typ}`
        if (!Suducers[key] || !Suducers[key][sudId]) { return None }
        return Some(Suducers[key][sudId] as Suducer)
    }

    static updateSuducer(suducer: Suducer): void {
        const key = `${suducer.chain.toLowerCase()}-${suducer.type}`
        Suducers[key][suducer.id!] = suducer
    }

    static getSuducers(chain: string, typ: SuducerT): Option<SuducersT> {
        const key = `${chain.toLowerCase()}-${typ}`
        if (!Suducers[key]) {
            return None
        }
        return Some(Suducers[key])
    }

    static delSuducer(chain: string, typ: SuducerT, sudId: IDT): void {
        const key = `${chain.toLowerCase()}-${typ}`
        delete Suducers[key][sudId]
    }

    // topic - suducerId map
    static getSuducerId(chain: string, method: string): Option<IDT> {
        if (!TopicSudidMap[chain] || !TopicSudidMap[chain][method]) {
            return None
        }
        return Some(TopicSudidMap[chain][method])
    }

    static addTopicSudid(chain: string, method: string, sudid: IDT): void {
        TopicSudidMap[chain] = TopicSudidMap[chain] || {}
        TopicSudidMap[chain][method] = sudid
    }

    static delTopicSudid(chain: string, method: string): void {
        delete TopicSudidMap[chain][method]
    }

    // requestID -- method
    static addSubCache(reqId: string, method: string): void {
        // const key = `${chain.toLowerCase()}-${reqId}`
        SubCache[reqId] = method
    }

    static getSubCache(reqId: string): Option<string> {
        if (!SubCache[reqId]) { return None }
        return Some(SubCache[reqId])
    }

    static delSubCache(reqId: string): void {
        delete SubCache[reqId]
    }
}

export default G