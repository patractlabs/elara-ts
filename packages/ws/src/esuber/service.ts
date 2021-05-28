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
import c from 'config'

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
    // log.info('G rpcs: ', G.rpcs)
    log.info('G chains: ', G.chains)
    log.info('G pool: ', G.cpool)
}

// depends on chain evnet
const getExtends = (chain: string, strategy: RpcStrategy): string[] => {
    const extens = G.chainConf[chain]['extends'] as RpcMapT
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

// depends on chain evnet
const getExcludes = (chain: string): string[] => {
    const c = G.chainConf[chain]
    if (c && c['excludes']) {
        return c['excludes'] as string[]
    }
    return []
}

const generateID = (): number => {
    return randomReplaceId()
}

const buildReq = (id: number, method: string, params: any[]): string => {
    return JSON.stringify({
        "id": id,
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    })
}

// no parameters allowed
const send = (chain: string, method: string, type: SuberType) => {
    const id = generateID()
    const req = buildReq(id, method, [])
    if (type === SuberType.Cache) {
        G.idMethod[id] = method
    }
    Pool.send(chain, type, req)
}

namespace Cacheable {
    // TODO cacheable trategy expiration?
    // when chain is update, G.chain G.chainConf is updated

    const excuteActiveSyncList = (chain: string, stratgy: RpcStrategy) => {
        const rpcs = G.rpcs[stratgy]  // donot change this rpcs
        // extends list
        const extens: string[] = getExtends(chain, stratgy)
        const nrpcs = [...rpcs, ...extens]

        const excludes = getExcludes(chain)
        log.info(`Extends & excludes list of chain[${chain}]: `, extens, excludes)
        // log.info(`Rpc list of chain[${chain}]-[${stratgy}] to sync: `, rpcs)
        for (let r of nrpcs) {
            if (excludes.indexOf(r) !== -1) {
                log.warn(`Rpc method[${r}] of chain[${chain}] is excluded.`)
                continue
            }
            send(chain, r, SuberType.Cache)
        }
    }

    const runSyncJob = (second: number, strategy: RpcStrategy) => {
        const interval = setInterval(() => {
            for (let c of G.chains) {
                excuteActiveSyncList(c, strategy)
            }
        }, second * 1000)
        G.intervals[strategy] = interval
    }

    const syncAsBlockService = async () => {
        runSyncJob(5, RpcStrategy.SyncAsBlock, )
    }

    const syncLowService = () => {
        runSyncJob(10 * 60, RpcStrategy.SyncLow)
    }

    export const syncOnceService = (chain: string) => {
        const brpcs = G.rpcs.SyncOnce
        let excludes = getExcludes(chain)
        
        for (let r of brpcs) {
            if (excludes.indexOf(r) !== -1 || r.indexOf('Meta') !== -1) { 
                log.warn(`Rpc method [${r}] is excluded`)
                continue 
            }
            send(chain, r, SuberType.Cache)
        }
    }

    export const run = () => {
        syncAsBlockService()
        syncLowService()
        for (let c of G.chains) {
            syncOnceService(c)
        }
    }
}

namespace Subscribe {

    export const subscribeService = (chain: string) => {
        log.error('Into subscribe: ', chain)
        const subs = G.rpcs.Subscribe
        let excludes = getExcludes(chain)
        log.info('subscriptions-excludes: ', subs, excludes)
        for (let s of subs) {
            if (excludes.indexOf(s) !== -1) { 
                log.warn(`topic [${s}] is excluded`)
                continue 
            }
            if (s.indexOf('NewHead') !== -1) {
                log.warn('subscribe ', s)
                send(chain, s, SuberType.Sub)
            }
        }
    }

    const kvService = (chain: string) => {
        // TODO
        // if kv config run config
        // else as the direct request
    }
}

namespace Reqresp {
    // RpcStrategy.Direct
}

namespace History {
    // getStorage ..., polling ...
    const historyService = (chain: string) => {

    }
}

const extendsHandler = (chain: string) => {
    
    let extens = G.chainConf[chain]['extends'] as RpcMapT

    for (let r in extens) {
        switch(extens[r]) {
        case RpcStrategy.SyncOnce:
            send(chain, r, SuberType.Cache)   
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
        default:
            // Do nothing
            // Direct, SyncLow, SyncAsBlock
            log.warn(`New extends config of chain[${chain}]-[${r}], Do Nothing!`)
            break
        }
    }
}

namespace Service {
    export const up = async (secure: boolean) => {
        await setup(secure)

        //TODO service trigger when suber OK
        setTimeout(() => {
            Cacheable.run()
            for (let c of G.chains) {
                // Subscr.subscribeService(c)
            }
        }, 1000);
    }
    export const Cache = Cacheable
    export const Subscr = Subscribe
}

export = Service