import { getAppLogger, ChainConfig, RpcMethodT, RpcMapT, RpcStrategy } from 'lib'
import { ChainPoolT } from './interface'

const log = getAppLogger('suducer-g', true)
// do not export to other components, export
// the relate api. e.g. updateWS to change G.ws
export namespace G {
    export let cpool: ChainPoolT  = {}
    export let chainConf: {[key in string]: ChainConfig } = {}
    export let chains: string[] = []
    export let intervals: {[key: string]: NodeJS.Timeout} = {}     // some schedulers
    export let rpcs: RpcMethodT = {}

    export let ResultQueen = {}
    export let idMethod: {[key in number]: string} = {}

    // depends on chain evnet
    export const getExtends = (chain: string, strategy: RpcStrategy): string[] => {
        const cconf = G.chainConf[chain]
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
        const c = G.chainConf[chain]
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