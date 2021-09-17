/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
import { getAppLogger, isNone } from '@elara/lib'
import { G } from './global'
import Chain, { ChainConfig, NodeType } from './chain'
import Pool from './pool'
import { SuducerT } from './suducer'
import { randomId } from '@elara/lib'
import { CacheStrategyT, ReqT } from './interface'

const log = getAppLogger('suducer')

const buildReq = (id: string, method: string, params: any[]): ReqT => {
    return { id, jsonrpc: "2.0", method, params }
}

// no parameters allowed
const sendWithoutParam = (chain: string, nodeId: string, method: string, type: SuducerT) => {
    let id: string

    switch (type) {
        case SuducerT.Sub:
            // topic - subscribe id
            id = randomId()
            G.addSubCache(id, method)
            break
        case SuducerT.Cache:
            id = `chain-${chain}-${nodeId}-${method}`
            // method cache
            break
        default:
            log.error(`no this suducer type: ${type}`)
            return
    }
    // all the cache & subscribe method has no params
    const req = buildReq(id, method, [])
    Pool.send(chain, nodeId, type, req)
}

const excuteStrategyList = (rpcs: string[], chain: string, nodeId: string, type: SuducerT) => {
    for (let r of rpcs) {
        sendWithoutParam(chain, nodeId, r, type)
    }
}

namespace Service {

    export namespace Cacheable {

        const runSyncJob = (chain: string, nodeId: string, second: number, strategy: CacheStrategyT): void => {
            const rpcs = G.getCacheByType(strategy)
            if (rpcs.length < 1) {
                log.warn(`no item to excute in chain ${chain} cache strategy: ${strategy}`)
                return
            }

            const interval = setInterval(() => {
                log.info(`run chain ${chain} strategy ${strategy} cache job`)
                excuteStrategyList(rpcs, chain, nodeId, SuducerT.Cache)
            }, second * 1000)
            G.addInterval(chain, strategy, interval)
        }

        const syncAsBlockService = async (chain: string, nodeId: string) => {
            log.info(`run syncAsBlock service interval: 5s`)
            runSyncJob(chain, nodeId, 5, CacheStrategyT.SyncAsBlock)
        }

        const syncLowService = (chain: string, nodeId: string) => {
            log.info(`run syncLow service interval: 60s`)
            runSyncJob(chain, nodeId, 10 * 60, CacheStrategyT.SyncLow)
        }

        export const syncOnceService = (chain: string, nodeId: string) => {
            log.info(`run syncOnce service chain ${chain}-${nodeId}`)
            const rpcs = G.getCacheByType(CacheStrategyT.SyncOnce)
            const req = buildReq(`chain-${chain}-${nodeId}-chain_getBlockHash_0`, "chain_getBlockHash", [0])
            Pool.send(chain, nodeId, SuducerT.Cache, req)
            excuteStrategyList(rpcs, chain, nodeId, SuducerT.Cache)
        }

        export const run = (chains: ChainConfig[]) => {
            for (let chain of chains) {
                const { name, nodeId } = chain
                log.info(`chain ${name} subscribe pool event done type cache`)
                syncAsBlockService(name, nodeId)
                syncLowService(name, nodeId)
            }
        }
    }


    export namespace Subscribe {

        export const subscribeService = async (chain: string, nodeId: string) => {
            const subs = G.getSubTopics()
            log.info(`run subscribe service chain ${chain}-${nodeId}`)
            excuteStrategyList(subs, chain, nodeId, SuducerT.Sub)
        }

        export const run = async (chains: ChainConfig[]) => {
            for (let chain of chains) {
                const { name, nodeId, type } = chain
                if (type !== NodeType.Node) { continue }
                log.info(`run subscribe topic of chain ${name}-${nodeId}`)

                log.warn(`chain ${name}-${nodeId} subscribe pool event done`)
                subscribeService(name, nodeId)
            }
        }
    }

    export const up = async (secure: boolean) => {
        // init a ws connection for all chains
        await Chain.init()
        log.info(`chain init done`)
        const re = G.getAllChains()
        if (isNone(re)) {
            log.error(`no chains available`)
            process.exit(1)
        }
    
        Pool.init((args: any[]) => {
            log.info(`suducer init done, service up: %o`, args)
            Service.Cacheable.run(re.value)
        }, secure)
    }
}

export default Service