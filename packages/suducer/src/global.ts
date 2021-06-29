import { getAppLogger, ChainConfig, RpcMethodT, RpcMapT, RpcStrategy, IDT } from 'lib'
import { None, Some, Option } from 'lib'
import { ChainPoolT, ChainT, SuducerMap, SuducersT } from './interface'
import Suducer, { SuducerT } from './suducer'

const log = getAppLogger('global', true)

const Chains: ChainT = {}
const Suducers: SuducerMap = {}

export namespace G {
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

    export const getAllChains = (): Option<ChainT> => {
        if (Chains === {}) {
            return None
        }
        return Some(Chains)
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