import { Redis, ChainConfig, KEYS } from 'lib'
import { Topic } from '../types'

const KEY = KEYS.Chain

const chainClient = Redis.newClient(Redis.DBT.Chain)
const chainRd = chainClient.client

Redis.onConnect(chainClient)
Redis.onError(chainClient)

namespace Rd {
    export const chainName = async (chain: string) => {
        return chainRd.hget(KEY.hChain(chain), 'name')
    }

    export const chainDetail = async (chain: string) => {
        return chainRd.hgetall(KEY.hChain(chain))
    }

    export const setChain = async (chain: ChainConfig) => {
        return chainRd.hmset(KEY.hChain(chain.name), chain)
    }

    export const delChain = async (chain: string) => {
        return chainRd.del(KEY.hChain(chain))
    }

    export const incrChainNum = async () => {
        return chainRd.incr(KEY.chainNum())
    }

    export const decrChainNum = async () => {
        return chainRd.decr(KEY.chainNum())
    }

    export const zaddChain = async (score: number, chain: string) => {
        return chainRd.zadd(KEY.zChainList(), score, chain.toLowerCase())
    }

    export const zremChain = async (chain: string) => {
        return chainRd.zrem(KEY.zChainList(), chain)
    }

    export const zrangeChain = async () => {
        return chainRd.zrange(KEY.zChainList(), 0, -1)
    }

    export const publishTopic = async (topic: Topic, chain: string) => {
        return chainRd.publish(topic, chain)
    }
}

export default Rd