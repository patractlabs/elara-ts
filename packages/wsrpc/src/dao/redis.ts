import { Redis, DBT, getAppLogger, KEYS, PVoidT } from '@elara/lib'
import Conf from '../../config'

const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')

const rconf = Conf.getRedis()

// TODO redis pool
const chainRedis = new Redis(DBT.Chain, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password,
    }
})

const userRedis = new Redis(DBT.User, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const proRedis = new Redis(DBT.Project, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const cacheRedis = new Redis(DBT.Cache, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const statRedis = new Redis(DBT.Stat, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const cacheRd = cacheRedis.getClient()
const chainRd = chainRedis.getClient()
const userRd = userRedis.getClient()
const proRd = proRedis.getClient()
const StatRd = statRedis.getClient()

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

statRedis.onConnect(() => {
    log.info(`stat db cache connection open: ${rconf.host}:${rconf.port}  ${rconf.password}`)
})

statRedis.onError((err: string) => {
    log.error(`stat redis cache connectino error: ${err}`)
    process.exit(2)
})

class Rd {

    /// chain operation
    static async getChainList() {
        return chainRd.zrange(KChain.zChainList(), 0, -1)
    }

    static async getChainIds(chain: string): Promise<string[]> {
        return chainRd.zrange(KChain.zChainIds(chain), 0, -1)
    }

    static async getChainInstance(chain: string, nodeId: number) {
        return chainRd.hgetall(KChain.hChain(chain, nodeId))
    }

    /// cache operation

    static async setLatest(chain: string, method: string, result: any) {
        // TODO whether expiration
        const updateTime = Date.now()
        const latest = {
            updateTime,
            result
        }
        log.error('data to be dump: %o', latest)
        return cacheRd.hmset(KCache.hCache(chain, method), latest)
    }

    static async getLatest(chain: string, method: string) {
        return cacheRd.hgetall(KCache.hCache(chain, method))
    }

    // user status
    static async getUserStatus(userId: number): Promise<Record<string, string>> {
        return userRd.hgetall(KEYS.User.hStatus(userId))
    }
    // project status
    static async getProStatus(chain: string, pid: string): Promise<Record<string, string>> {
        return proRd.hgetall(KEYS.Project.hProjectStatus(chain, pid))
    }

    // clear project statistic
    static async clearProjectStatistic(chain: string, pid: string): PVoidT {
        const stream = StatRd.scanStream({
            match: `*_${chain.toLowerCase()}_${pid}*`
        })
        stream.on('data', (keys: string[]) => {
            log.warn(`start to clear ${chain} project[${pid}] keys: %o`, keys)
            keys.forEach(key => {
                StatRd.unlink(key)
            })
        })
        stream.on('end', () => {
            log.info(`all statistic record be cleared of ${chain} project[${pid}]`)
        })
    }
}

export default Rd