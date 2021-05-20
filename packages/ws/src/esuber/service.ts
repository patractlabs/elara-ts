/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
/// TODO: SyncAsBlock is ovelap with the subscription

import { KEYS, getAppLogger } from 'lib'
import { chainRd } from '../db/redis'

const KEY = KEYS.Chain
const log = getAppLogger('esuber', true)

namespace G {
    export let chainStrategy = {}
    export let chains: string[] = []
    export let intervals: NodeJS.Timeout[] = []
}


const fetchChains = async () => {
    let chains = await chainRd.zrange(KEY.zChainList(), 0, -1)
    log.info('chain list: ', chains)
    G.chains = chains
}

const parseChainConfig = async (chain: string) => {
    let key = KEY.hChain(chain)
    let exs = await chainRd.hmget(key, ['extends', 'excludes'])

    let extens = []
    let excludes= []
    if (exs[0] !== null) {
        extens = JSON.parse(exs[0])
        for (let e in extens) {
            log.info(e, extens[e])
        }
    }
    if (exs[1] !== null) {
        excludes = JSON.parse(exs[1])
        for (let e of excludes) {
            log.info(e)
        }
    }

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
    let interval = setInterval(() => {

    }, 5 * 1000)
    G.intervals.push(interval)
}

const syncLowService = (chain: string) => {
    let interval = setInterval(() => {

    }, 10 * 60 * 1000)
}

const syncOnceService = (chain: string) => {
     

}

const subscribeService = (chain: string) => {
    // 1. get base subscription list
    // 2. extends and excludes
    // 3. request & cache
}

const kvService = (chain: string) => {

}

const activeScheduler = (chain: string) => {
    // active this chain
}

const serviceTrigger = (chain: string) => {
    activeScheduler(chain)
    syncOnceService(chain)
    subscribeService(chain)
    kvService(chain)
}

const init = ()=> {

}

init()