import { Redis } from 'lib/utils'
import { getAppLogger, KEYS } from 'lib'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')

// TODO redis pool

const chainRd = new Redis({db: 3})

// pubsub connection only support pub/sub relate command
export const chainPSub = new Redis()

const cacheRd = new Redis({db: 4})


chainRd.on('connect', (e) => {
    log.info('Chain redis connected successfully')
})

chainRd.on('error', (e) => {
    log.error('Chain redis error: ', e)
})

namespace Rd {

    // TODO Result typelize

    /// chain operation
    export const getChainList = async () => {
        return chainRd.zrange(KChain.zChainList(), 0, -1)
    }

    export const getChainConfig = async (chain: string) => {
        return chainRd.hgetall(KChain.hChain(chain))
    }


    /// cache operation

    export const setLatest = async (chain: string, method: string, result: any) => {
        // TODO whether expiration
        const updateTime = Date.now()
        const latest = {
            updateTime,
            result
        }
        log.error('data to be dump: ', latest)
        return cacheRd.hmset(KCache.hCache(chain, method), latest)
    }

    export const getLatest = async (chain: string, method: string) => {
        return cacheRd.hgetall(KCache.hCache(chain, method))
    }

}

export default Rd