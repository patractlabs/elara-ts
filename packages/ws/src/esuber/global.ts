import { ChainConfig, RpcMethods, RpcMethodT, RpcStrategy } from 'lib'
import { ChainPoolT } from './interface'

// do not export to other components, export
// the relate api. e.g. updateWS to change G.ws
export namespace G {
    export let cpool: ChainPoolT  = {}
    export let scheduler: {} = {}
    export let chainConf: {[key in string]: ChainConfig } = {}
    export let chains: string[] = []
    export let intervals: {[key: string]: NodeJS.Timeout} = {}     // some schedulers
    export let rpcs: any = {}

    export let ResultQueen = {}
}