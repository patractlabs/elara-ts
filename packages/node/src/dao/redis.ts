import { Redis } from 'elara-lib'
import { getAppLogger, KEYS } from 'elara-lib'

// const KCache = KEYS.Cache
const KChain = KEYS.Chain

const log = getAppLogger('redis')
log.info('Redis connection init')

const chainClient = Redis.newClient(Redis.DBT.Chain)
const chainRedis = chainClient.client

Redis.onError(chainClient)
Redis.onConnect(chainClient)

// pubsub connection only support pub/sub relate command
const chainPSClient = Redis.newClient(Redis.DBT.Chain)

Redis.onConnect(chainPSClient)
Redis.onError(chainPSClient)

namespace Rd {
    export const chainPSub = chainPSClient.client

    export const getChainList = async () => {
        return chainRedis.zrange(KChain.zChainList(), 0, -1)
    }

    export const getChainConfig = async (chain: string) => {
        return chainRedis.hgetall(KChain.hChain(chain))
    }
}

export default Rd