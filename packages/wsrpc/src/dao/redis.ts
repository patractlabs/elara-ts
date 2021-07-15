import { Redis, DBT } from '@elara/lib'
import { getAppLogger, KEYS } from '@elara/lib'
import Conf from '@flipcards/wsrpc/config'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')

const rconf = Conf.getRedis()

// TODO redis pool
const chainRd = new Redis(DBT.Chain, { host: rconf.host, port: rconf.port })
const chainRedis = chainRd.getClient()

chainRd.onError((err: string) => {
    log.error(`redis db chain connectino error: ${err}`)
    process.exit(2)
})

chainRd.onConnect(() => {
    log.info(`redis db chain connection open`)
})

const cacheRd = new Redis(DBT.Cache, { host: rconf.host, port: rconf.port })
const cacheRedis = cacheRd.getClient()

cacheRd.onConnect(() => {
    log.info(`redis db cache connection open`)
})

cacheRd.onError((err: string) => {
    log.error(`chain redis cache connectino error: ${err}`)
    process.exit(2)
})

namespace Rd {

    /// chain operation
    export const getChainList = async () => {
        return chainRedis.zrange(KChain.zChainList(), 0, -1)
    }

    export const getChainConfig = async (chain: string) => {
        return chainRedis.hgetall(KChain.hChain(chain))
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
        return cacheRedis.hmset(KCache.hCache(chain, method), latest)
    }

    export const getLatest = async (chain: string, method: string) => {
        return cacheRedis.hgetall(KCache.hCache(chain, method))
    }

}

export default Rd