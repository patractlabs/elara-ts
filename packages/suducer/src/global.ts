import EventEmitter from 'events'
import { getAppLogger, ChainConfig, RpcMethodT, RpcMapT, RpcStrategy, IDT } from 'lib'
import { None, Some, Option } from 'lib'
import { CacheT, ChainPoolT, ChainT, SuducerMap, SuducersT, PubsubT, CacheStrategyT, PsubStrategyT, TopicT } from './interface'
import { del } from './pool'
import Suducer, { SuducerT } from './suducer'

const log = getAppLogger('global', true)

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
        "system_version",
        "system_chain",
        "system_chainType",
        "system_properties",
        "state_getMetadata" 
    ],
    SyncLow: []
}
const Pubsubs: PubsubT = {
    Sub: [
        "chain_subscribeAllHeads",
        "chain_subscribeNewHeads", 
        "chain_subscribeFinalizedHeads", 
        "state_subscribeRuntimeVersion",   
        "state_subscribeStorage", 
        "grandpa_subscribeJustifications"
    ],
    Unsub: [
        "chain_unsubscribeAllHeads",
        "chain_unsubscribeNewHeads",
        "chain_unsubscribeFinalizedHeads", 
        "state_unsubscribeRuntimeVersion", 
        "state_unsubscribeStorage",
        "grandpa_unsubscribeJustifications"
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

    export const decrPoolCnt = (chain: string, type: SuducerT): void => {
        const key = `${chain.toLowerCase()}-${type}`
        PoolCnt[key] -= 1
    }

    // pool event
    export const setPoolEvt = (chain: string, type: SuducerT, evt: EventEmitter) => {
        const key = `${chain.toLowerCase()}-${type}`
        PoolEvt[key] = evt
    }

    export const getPoolEvt = (chain: string, type: SuducerT): EventEmitter => {
        const key = `${chain.toLowerCase()}-${type}`
        return PoolEvt[key]
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

    export const getSubMap = (): StringMapT => {
        return Submap
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
        if (Chains === {}) {
            return None
        }
        return Some(Object.keys(Chains))
    }

    export const getAllChainConfs = (): Option<ChainT> => {
        if (Chains === {}) {
            return None
        }
        return Some(Chains)
    }

    // intervals 
    export const addInterval = (key: CacheStrategyT, interval: NodeJS.Timeout) => {
        if (Intervals[key]) {
            log.error(`add interval error: ${key} exist`)
            return
        }
        Intervals[key] = interval
    }

    export const delInterval = (key: CacheStrategyT) => {
        delete Intervals[key]
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

    export const delTOpicSudid = (chain: string, method: string): void => {
        delete TopicSudidMap[chain][method]
    }


    export let cpool: ChainPoolT  = {}
    export let chains: string[] = []
    export let intervals: {[key: string]: NodeJS.Timeout} = {}     // some schedulers
    export let rpcs: RpcMethodT = {}

    export let ResultQueen = {}
    export let idMethod: {[key in number]: string} = {}

    // depends on chain evnet
    export const getExtends = (chain: string, strategy: RpcStrategy): string[] => {
        const cconf = Chains[chain]
        if (!cconf || !cconf['extends']) {
            return []
        }
        const extens = cconf['extends'] as RpcMapT
        // log.error(`extens of chain[${chain}]: `, extens)
        let res: string[] = []
        for (let k in extens) {
            if (extens[k] === strategy) {
                res.push(k)
            }
        }
        log.warn(`Extends list of chain[${chain}]-[${strategy}]: `, res)
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

    export const getRpcs = (): RpcMethodT => {
        return G.rpcs
    }

    export const getRpcByType = (strategy: RpcStrategy): string[] => {
        if (!G.rpcs || !G.rpcs[strategy]) { 
            log.warn('No this trategy rpcs: ', strategy)
            return [] 
        }
        return G.rpcs[strategy]!
    }
}
export default G