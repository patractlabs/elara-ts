import Redis, { DBT } from 'elara-lib/utils/redis'
import { getAppLogger, KEYS } from 'elara-lib'

// const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')
log.info('Redis connection init')

const chainClient = new Redis(DBT.Chain)
const chainRedis = chainClient.getClient()

chainClient.onError((err: string) => {
    log.error(`redis db chain conection error: ${err}`)
    process.exit(1)
})
chainClient.onConnect(() => {
    log.info(`redis db chain connection open`)
})

// pubsub connection only support pub/sub relate command
const chainPSClient = new Redis(DBT.Chain)

chainPSClient.onConnect(() => {
    log.info(`redis db chain connection open`)
})
chainPSClient.onError((err: string) => {
    log.error(`redis db chain-ps conection error: ${err}`)
    process.exit(1)
})

namespace Rd {
    export const chainPSub = chainPSClient.getClient()

    export const getChainList = async () => {
        return chainRedis.zrange(KChain.zChainList(), 0, -1)
    }

    export const getChainConfig = async (chain: string) => {
        return chainRedis.hgetall(KChain.hChain(chain))
    }
}

export default Rd