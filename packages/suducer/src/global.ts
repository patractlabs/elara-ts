import EventEmitter from 'events'
import { getAppLogger, ChainConfig, RpcMapT, RpcStrategy, IDT } from '@elara/lib'
import { None, Some, Option } from '@elara/lib'
import { CacheT, ChainT, SuducerMap, SuducersT, PubsubT, CacheStrategyT, PsubStrategyT } from './interface'
import Suducer, { SuducerT } from './suducer'

const log = getAppLogger('global')

const Intervals: {[key in string]: NodeJS.Timeout} = {}

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
type StringMapT = {[key in string]: string}
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

type TopicMapT = {[key in string]: IDT}
const TopicSudidMap: {[key in string]: TopicMapT} = {}

const PoolCnt: {[key in string]: number} = {}
const PoolEvt: {[key in string]: EventEmitter} = {}

// requestId -- method
const SubCache: {[key in string]: string} = {}

export namespace G {
    // pool count
    export const setPoolCnt = (chain: string, type: SuducerT, cnt: number) => {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] = cnt
    }

    export const getPoolCnt = (chain: string, type: SuducerT): number => {
        const key = `${chain.toLowerCase()}-${type}`
        return PoolCnt[key]
    }

    export const incrPoolCnt = (chain: string, type: SuducerT): void => {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] += 1
    }

    export const decrPoolCnt = (chain: string, type: SuducerT): void => {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] -= 1
    }

    // pool event
    export const setPoolEvt = (type: SuducerT, evt: EventEmitter) => {
        PoolEvt[type] = evt
    }

    export const delPoolEvt = (type: SuducerT) => {
        delete PoolEvt[type]
    }

    export const getPoolEvt = (type: SuducerT): EventEmitter => {
        return PoolEvt[type]
    }

    export const getAllPoolEvt = () => {
        return PoolEvt
    }

    // strategy 
    export const getCacheMap = (): CacheT => {
        return Caches
    }

    export const getCacheByType = (type: CacheStrategyT): string[] => {
        return Caches[type]
    }

    export const getPubsubMap = (): PubsubT => {
        return Pubsubs
    }

    export const getSubTopics = (): string[] => {
        return Pubsubs[PsubStrategyT.Sub]
    }

    export const getUnsubTopics = (): string[] => {
        return Pubsubs[PsubStrategyT.Unsub]
    }

    export const getExtrinMap = (): PubsubT => {
        return Extrinsics
    }

    export const getSubMaps = (): StringMapT => {
        return Submap
    }

    export const getSubMethod = (method: string): Option<string> => {
        if (!Submap[method]) { return None}
        return Some(Submap[method])
    }

    // chain config op
    export const addChain = (chain: ChainConfig): void => {
        const name = chain.name.toLowerCase()
        Chains[name] = chain
    }

    export const updateChain = (chain: ChainConfig): void => {
        Chains[chain.name.toLowerCase()] = chain
    }

    export const getChain = (chain: string): Option<ChainConfig> => {
        const key = chain.toLowerCase()
        if (!Chains[key]) {
            return None
        }
        return Some(Chains[key])
    }

    export const delChain = (chain: string): void => {
        delete Chains[chain.toLowerCase()]
    }

    export const getAllChains = (): Option<string[]> => {
        if (Chains == {}) {
            return None
        }
        return Some(Object.keys(Chains))
    }

    export const getAllChainConfs = (): Option<ChainT> => {
        if (Chains == {}) {
            return None
        }
        return Some(Chains)
    }

    // intervals 
    export const addInterval = (chain: string, strategy: CacheStrategyT, interval: NodeJS.Timeout) => {
        const key = `${chain.toLowerCase()}-${strategy}`
        if (Intervals[key]) {
            log.error(`add interval error: ${key} exist`)
            return
        }
        Intervals[key] = interval
    }
    
    export const delInterval = (chain: string, strategy: CacheStrategyT) => {
        delete Intervals[`${chain.toLowerCase()}-${strategy}`]
    }

    // suducer 
    export const addSuducer = (suducer: Suducer): void => {
        const key = `${suducer.chain.toLowerCase()}-${suducer.type}`
        Suducers[key] = Suducers[key] || {}
        Suducers[key][suducer.id!] = suducer
    }

    export const getSuducer = (chain: string, typ: SuducerT, sudId: IDT): Option<Suducer> => {
        const key = `${chain.toLowerCase()}-${typ}`
        if (!Suducers[key] || !Suducers[key][sudId]) { return None }
        return Some(Suducers[key][sudId] as Suducer)
    }

    export const updateSuducer = (suducer: Suducer): void => {
        const key = `${suducer.chain.toLowerCase()}-${suducer.type}`
        Suducers[key][suducer.id!] = suducer
    }

    export const getSuducers = (chain: string, typ: SuducerT): Option<SuducersT> => {
        const key = `${chain.toLowerCase()}-${typ}`
        if (!Suducers[key]) {
            return None
        }
        return Some(Suducers[key])
    }

    export const delSuducer = (chain: string, typ: SuducerT, sudId: IDT): void => {
        const key = `${chain.toLowerCase()}-${typ}`
        delete Suducers[key][sudId]
    }

    // topic - suducerId map
    export const getSuducerId = (chain: string, method: string): Option<IDT> => {
        if (!TopicSudidMap[chain] || !TopicSudidMap[chain][method]) {
            return None
        }
        return Some(TopicSudidMap[chain][method])
    }

    export const addTopicSudid = (chain: string, method: string, sudid: IDT): void => {
        TopicSudidMap[chain] = TopicSudidMap[chain] || {}
        TopicSudidMap[chain][method] = sudid
    }
    
    export const delTopicSudid = (chain: string, method: string): void => {
        delete TopicSudidMap[chain][method]
    }

    // requestID -- method
    export const addSubCache = (reqId: string, method: string): void => {
        // const key = `${chain.toLowerCase()}-${reqId}`
        SubCache[reqId] = method
    }

    export const getSubCache = (reqId: string): Option<string> => {
        if (!SubCache[reqId]) { return None }
        return Some(SubCache[reqId])
    }

    export const delSubCache = (reqId: string): void => {
        delete SubCache[reqId]
    }

    // depends on chain evnet
    export const getExtends = (chain: string, strategy: RpcStrategy): string[] => {
        const cconf = Chains[chain]
        if (!cconf || !cconf['extends']) {
            return []
        }
        const extens = cconf['extends'] as RpcMapT
        // log.error(`extens of chain[${chain}]: %o`, extens)
        let res: string[] = []
        for (let k in extens) {
            if (extens[k] === strategy) {
                res.push(k)
            }
        }
        log.warn(`Extends list of chain[${chain}]-[${strategy}]: %o`, res)
        return res
    }

    // depends on chain event
    export const getExcludes = (chain: string): string[] => {
        const c = Chains[chain]
        if (c && c['excludes']) {
            return c['excludes'] as string[]
        }
        return []
    }
}
export default G