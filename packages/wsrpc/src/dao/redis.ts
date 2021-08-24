import { Redis, DBT, getAppLogger, KEYS } from '@elara/lib'
import Conf from '../../config'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')

const rconf = Conf.getRedis()

// TODO redis pool
const chainRedis = new Redis(DBT.Chain, { host: rconf.host, port: rconf.port,options:{

    password:rconf.password
} })
const userRedis = new Redis(DBT.User, { host: rconf.host, port: rconf.port ,options:{

    password:rconf.password
}})
const proRedis = new Redis(DBT.Project, { host: rconf.host, port: rconf.port ,options:{

    password:rconf.password
}})
const cacheRedis = new Redis(DBT.Cache, { host: rconf.host, port: rconf.port ,options:{

    password:rconf.password
}})

const cacheRd = cacheRedis.getClient()
const chainRd = chainRedis.getClient()
const userRd = userRedis.getClient()
const proRd = proRedis.getClient()

chainRedis.onError((err: string) => {
    log.error(`redis db chain connectino error: ${err}`)
    process.exit(2)
})

chainRedis.onConnect(() => {
    log.info(`redis db chain connection open: ${rconf.host}:${rconf.port} ${rconf.password}`)
})

userRedis.onError((err: string) => {
    log.error(`redis db user connectino error: ${err}`)
    process.exit(2)
})

userRedis.onConnect(() => {
    log.info(`redis db user connection open: ${rconf.host}:${rconf.port}  ${rconf.password}`)
})

proRedis.onError((err: string) => {
    log.error(`redis db project connectino error: ${err}`)
    process.exit(2)
})

proRedis.onConnect(() => {
    log.info(`redis db project connection open: ${rconf.host}:${rconf.port}  ${rconf.password}`)
})

cacheRedis.onConnect(() => {
    log.info(`redis db cache connection open: ${rconf.host}:${rconf.port}  ${rconf.password}`)
})

cacheRedis.onError((err: string) => {
    log.error(`chain redis cache connectino error: ${err}`)
    process.exit(2)
})

namespace Rd {

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
        log.error('data to be dump: %o',latest)
        return cacheRd.hmset(KCache.hCache(chain, method), latest)
    }

    export const getLatest = async (chain: string, method: string) => {
        return cacheRd.hgetall(KCache.hCache(chain, method))
    }

    // user status
    export const getUserStatus = async(userId: number): Promise<Record<string, string>> => {
        return userRd.hgetall(KEYS.User.hStatus(userId))
    }
    // project status
    export const getProStatus = async (chain: string, pid: string): Promise<Record<string, string>> => {
        return proRd.hgetall(KEYS.Project.hProjectStatus(chain, pid))
    }

}

export default Rd