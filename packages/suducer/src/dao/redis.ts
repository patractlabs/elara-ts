import { Redis, DBT } from '@elara/lib'
import { getAppLogger, KEYS } from '@elara/lib'
import { dotenvInit } from '@elara/lib'
import Mom from 'moment'
dotenvInit()
import Conf from '../../config'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')
const rdConf = Conf.getRedis()
log.warn(`current env ${process.env.NODE_ENV}, redis configure: ${JSON.stringify(rdConf)}`)

const chainRd = new Redis(DBT.Chain, {
    host: rdConf.host, port: rdConf.port, options: {
        password: rdConf.password
    }
})
const chainRedis = chainRd.getClient()

chainRd.onError((err: string) => {
    log.error(`redis db chain connection error: ${err}`)
    process.exit(1)
})
chainRd.onConnect(() => {
    log.info('redis db chain connection open')
})

const cacheRd = new Redis(DBT.Cache, {
    host: rdConf.host, port: rdConf.port, options: {
        password: rdConf.password
    }
})
const cacheRedis = cacheRd.getClient()

cacheRd.onConnect(() => {
    log.info('redis db cache connection open')
})
cacheRd.onError((err: string) => {
    log.error(`redis db cache connection error: ${err}`)
    process.exit(1)
})


type CacheT = {
    updateTime: number,
    result: any
}

class Rd {
    /// chain operation
    static async getChainList() {
        return chainRedis.zrange(KChain.zChainList(), 0, -1)
    }

    static async getChainIds(chain: string) {
        return chainRedis.zrange(KChain.zChainIds(chain), 0, -1)
    }

    static async getChainConfig(chain: string, serverId: number) {
        return chainRedis.hgetall(KChain.hChain(chain, serverId))
    }

    /// cache operation
    static async setLatest(chain: string, method: string, result: any) {
        // TODO whether expiration
        const updateTime = Mom().utcOffset('+08:00', false).valueOf()
        const latest = {
            updateTime,
            result: JSON.stringify(result)
        } as CacheT
        return cacheRedis.hmset(KCache.hCache(chain, method), latest)
    }

    static async getLatest(chain: string, method: string) {
        return cacheRedis.hgetall(KCache.hCache(chain, method))
    }
}

export default Rd