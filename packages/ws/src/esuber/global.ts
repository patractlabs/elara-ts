import { ChainConfig, RpcMethods } from 'lib'
import { ChainPoolT, ChainExtT } from './interface'

// do not export to other components, export
// the relate api. e.g. updateWS to change G.ws
export namespace G {
    export let cpool: ChainPoolT  = {}
    export let chainExt: ChainExtT = {}
    export let chainConf: {[key in string]: ChainConfig } = {}
    export let chains: string[] = []
    export let intervals: NodeJS.Timeout[] = []     // some schedulers
    export let rpcs = RpcMethods
}