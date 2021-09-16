/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
import { getAppLogger, isNone } from '@elara/lib'
import { G } from './global'
import Chain from './chain'
import Pool from './pool'
import { SuducerT } from './suducer'
import { randomId } from '@elara/lib'
import { CacheStrategyT, ReqT } from './interface'

const log = getAppLogger('suducer')

const buildReq = (id: string, method: string, params: any[]): ReqT => {
    return { id, jsonrpc: "2.0", method, params }
}

// no parameters allowed
const sendWithoutParam = (chain: string, method: string, type: SuducerT) => {
    let id: string

    switch (type) {
        case SuducerT.Sub:
            // topic - subscribe id
            id = randomId().toString()
            G.addSubCache(id, method)
            break
        case SuducerT.Cache:
            id = `chain-${chain}-${method}`
            // method cache
            break
        default:
            log.error(`no this suducer type: ${type}`)
            return
    }
    // all the cache & subscribe method has no params
    const req = buildReq(id, method, [])
    Pool.send(chain, type, req)
}

const excuteStrategyList = (rpcs: string[], chain: string, type: SuducerT) => {
    for (let r of rpcs) {
        sendWithoutParam(chain, r, type)
    }
}

namespace Service {

    export namespace Cacheable {

        const runSyncJob = (chain: string, second: number, strategy: CacheStrategyT): void => {
            const rpcs = G.getCacheByType(strategy)
            if (rpcs.length < 1) {
                log.warn(`no item to excute in chain ${chain} cache strategy: ${strategy}`)
                return
            }

            const interval = setInterval(() => {
                log.info(`run chain ${chain} strategy ${strategy} cache job`)
                excuteStrategyList(rpcs, chain, SuducerT.Cache)
            }, second * 1000)
            G.addInterval(chain, strategy, interval)
        }

        const syncAsBlockService = async (chain: string) => {
            log.info(`run syncAsBlock service interval: 5s`)
            runSyncJob(chain, 5, CacheStrategyT.SyncAsBlock)
        }

        const syncLowService = (chain: string) => {
            log.info(`run syncLow service interval: 60s`)
            runSyncJob(chain, 10 * 60, CacheStrategyT.SyncLow)
        }

        export const syncOnceService = (chain: string) => {
            log.info(`run syncOnce service chain ${chain}`)
            const rpcs = G.getCacheByType(CacheStrategyT.SyncOnce)
            const req = buildReq(`chain-${chain}-chain_getBlockHash_0`, "chain_getBlockHash", [0])
            Pool.send(chain, SuducerT.Cache, req)
            excuteStrategyList(rpcs, chain, SuducerT.Cache)
        }

        export const run = (chains: string[]) => {

            const evt = G.getPoolEvt(SuducerT.Cache)
            if (!evt) {
                log.error(`subscribe cache pool event error`)
                process.exit(2)
            }
            for (let chain of chains) {

                evt.once(`${chain}-open`, () => {
                    log.info(`chain ${chain} subscribe pool event done type cache`)
                    evt.removeAllListeners(`${chain}-open`)
                    syncOnceService(chain)
                    syncAsBlockService(chain)
                    syncLowService(chain)
                })
            }
        }
    }


    export namespace Subscribe {

        export const subscribeService = async (chain: string) => {
            const subs = G.getSubTopics()
            excuteStrategyList(subs, chain, SuducerT.Sub)
        }

        export const run = async (chains: string[]) => {

            let evt = G.getPoolEvt(SuducerT.Sub)
            if (!evt) {
                log.error(`subscribe pool event error`)
                process.exit(2)
            }
            for (let chain of chains) {
                log.info(`run subscribe topic of chain ${chain}`)

                evt.once(`${chain}-open`, () => {
                    log.info(`chain ${chain} subscribe pool event done`)
                    evt.removeAllListeners(`${chain}-open`)
                    subscribeService(chain)
                })
            }
        }
    }

    export const up = async (secure: boolean) => {
        // init a ws connection for all chains
        await Chain.init()
        log.info(`chain init done`)

        await Pool.init(secure)

        const re = G.getAllChains()
        if (isNone(re)) {
            log.error(`no chains valid`)
            process.exit(2)
        }
        const chains = re.value
        log.debug(`chain config list: %o`, chains)

        // cache service
        Cacheable.run(chains)

        // subscribe runtimeVersion update
        Subscribe.run(chains)
    }
}

export default Service