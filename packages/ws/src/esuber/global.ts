import { Suber } from './interface'
import { RpcMethods, RpcMethodT } from 'lib'
type ChainExtT = {[key: string]: RpcMethodT }
type WsPool = { [key: string]: Suber }

// do not export to other components, export
// the relate api. e.g. updateWS to change G.ws
export namespace G {
    export let ws: WsPool  = {}
    export let chainExt: ChainExtT = {}
    export let chainStrategy = {}
    export let chains: string[] = []
    export let intervals: NodeJS.Timeout[] = []
    export let rpcs = RpcMethods
}