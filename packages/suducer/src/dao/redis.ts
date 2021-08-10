import { Redis, DBT } from '@elara/lib'
import { getAppLogger, KEYS } from '@elara/lib'
import { dotenvInit } from '@elara/lib'
dotenvInit()
import Conf from '../../config'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')
const rdConf = Conf.getRedis()
log.warn(`current env ${process.env.NODE_ENV}, redis configure: ${JSON.stringify(rdConf)}`)
// TODO redis pool

const chainRd = new Redis(DBT.Chain, {host: rdConf.host, port: rdConf.port, options:{
    password:rdConf.password
}})
const chainRedis = chainRd.getClient()

chainRd.onError((err: string) => {
    log.error(`redis db chain connection error: ${err}`)
    process.exit(1)
})
chainRd.onConnect(() => {
    log.info('redis db chain connection open')
})

const cacheRd = new Redis(DBT.Cache, {host: rdConf.host, port: rdConf.port,options:{
    password:rdConf.password
}})
const cacheRedis = cacheRd.getClient()

cacheRd.onConnect(() => {
    log.info('redis db cache connection open')
})
cacheRd.onError((err: string) => {
    log.error(`redis db cache connection error: ${err}`)
    process.exit(1)
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

    type CacheT = {
        updateTime: number,
        result: any
    }

    export const setLatest = async (chain: string, method: string, result: any) => {
        // TODO whether expiration
        const updateTime = Date.now()
        const latest = {
            updateTime,
            result: JSON.stringify(result)
        } as CacheT
        return cacheRedis.hmset(KCache.hCache(chain, method), latest)
    }

    export const getLatest = async (chain: string, method: string) => {
        return cacheRedis.hgetall(KCache.hCache(chain, method))
    }
}

export default Rd