/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
/// TODO: SyncAsBlock is ovelap with the subscription
import { getAppLogger, RpcMapT, RpcStrategy } from 'lib'
import { G } from './global'
import Chain from './chain'
import Pool from './wspool'
import { SuberType } from './interface'
import { randomReplaceId } from 'lib/utils'
import Rd from '../db/redis'

const log = getAppLogger('esuber', true)

// init resource
const setup = async (secure: boolean) => {
    // init a ws connection for all chains
    await Chain.init()
    if (G.chains.length < 1) {
        log.error("Chain init failed. No chain exist!")
        process.exit(1)
    }
    await Pool.init()
    log.info('G rpcs: ', G.rpcs)
    log.info('G chains: ', G.chains)
    log.info('G pool: ', G.cpool)
}

const getExclude = (chain: string): string[] => {
    return G.chainConf[chain]['excludes'] as string[]
}

interface RpcReq {
    id: number | string,
    jsonrpc: string,
    method: string,
    params: string[]
}


const generateID = (): number => {
    return randomReplaceId()
}

const buildReq = (id: number, method: string, params: any[]): RpcReq => {
    return {
        "id": id,
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    }
}

const reqres = () => {

}

/// according to rpc strategy modulize the service
/// SyncAsBlock, SyncLow, SyncOnce, Subscribe, Kv, Abandon, Direct
/// all the service follow the step, 
///     1. get base rpc methods
///     2. extends and excludes
///     3. request & cache 
/// except the scheduler [SyncAsBlock, SyncLow], scheduler has a dynamic
/// config, request the active list
///     1. init scheduler
///     2. fetch the active chains
///     3. follow the above steps

const syncAsBlockService = async (chain: string) => {
    const interval = setInterval(() => {

    }, 5 * 1000)
    G.intervals[RpcStrategy.SyncAsBlock] = interval
}

const syncLowService = (chain: string) => {
    const interval = setInterval(() => {
        // read register list
        // dispatch
    }, 10 * 60 * 1000)
    G.intervals[RpcStrategy.SyncLow] = interval
}

// no parameters allowed
const syncOnceHandler = (chain: string, method: string) => {
    const id = generateID()
    const req = buildReq(id, method, [])
    Rd.setRpcMethod(chain, id, method)
    Pool.send(chain, SuberType.Chan, JSON.stringify(req))
}

const syncOnceService = (chain: string) => {
    let brpcs = G.rpcs.SyncOnce
    let excludes = getExclude(chain)
    
    log.info('rpcs: ', brpcs, excludes)
    for (let r of brpcs) {
        if (excludes.indexOf(r) !== -1) { 
            log.warn(`Rpc method [${r}] is excluded`)
            continue 
        }
        syncOnceHandler(chain, r)
    }
}

const subscribeHandler = (chain: string, subscription: string) => {
    // 1. get ws[sub] and rpc.sub strategy
    // 2. allocate sub 
    // 3. send subscribption  
    const id = generateID()
    const req = buildReq(id, subscription, [])
    Pool.send(chain, SuberType.Sub, JSON.stringify(req))
    // memory cache or redis?
}

const subscribeService = (chain: string) => {
    const subs = G.rpcs.Subscribe
    let excludes = getExclude(chain)
    log.info('subscriptions-excludes: ', subs, excludes)
    for (let s of subs) {
        if (excludes.indexOf(s) !== -1) { 
            log.warn(`topic [${s}] is excluded`)
            continue 
        }
        if (s.indexOf('submit') !== -1) {
            subscribeHandler(chain, s)
        }
    }
}

const kvService = (chain: string) => {
    // TODO
    // if kv config run config
    // else as the direct request
}


const extendsHandler = (chain: string) => {
    
    let extens = G.chainConf[chain]['extends'] as RpcMapT

    for (let r in extens) {
        switch(extens[r]) {
        case RpcStrategy.SyncOnce:
            syncOnceHandler(chain, r)   
            break
        case RpcStrategy.SyncLow:
            break
        case RpcStrategy.SyncAsBlock:
            break
        case RpcStrategy.Subscribe:
            break
        case RpcStrategy.Unsub:
            break
        case RpcStrategy.History:
            break
        case RpcStrategy.Kv:
            break
        case RpcStrategy.SyncHistory:
            break
        case RpcStrategy.Abandon:
            // SBH
            break
        case RpcStrategy.Direct:
            // do nothing
            break
        default:
            break
        }
    }
}

const activeScheduler = (chain: string) => {
    // active this chain
}

const up = (chain: string) => {
    activeScheduler(chain)
    syncOnceService(chain)
    subscribeService(chain)
    kvService(chain)
}

namespace Service {
    export const up = async (secure: boolean) => {
        await setup(secure)
        //TODO service trigger when suber OK
        //
        setTimeout(() => {
            syncOnceService('polkadot')         
            subscribeService('polkadot')
        }, 1000);
    }
}

export = Service