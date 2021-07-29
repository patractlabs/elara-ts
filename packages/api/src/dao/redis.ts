import { Redis, DBT, KEYS, getAppLogger, ChainConfig } from '@elara/lib'
import Account from '../service/account'
import { Topic } from '../service/chain'

const log = getAppLogger('redis')

const actKEY = KEYS.Account
const chainKEY = KEYS.Chain
const proKEY = KEYS.Project

export const statRd = new Redis(DBT.Stat).getClient()

export const projRd = new Redis(DBT.Project).getClient()

export const actRd = new Redis(DBT.Account).getClient()

const chainClient = new Redis(DBT.Chain)
export const chainRd = chainClient.getClient()

chainClient.onConnect(() => {
    log.info(`redis db chain connection open`)
})
chainClient.onError((err: string) => {
    log.error(`redis db chain connection error: ${err}`)
    process.exit(1)
})

namespace Rd {
    export async function haddAccount(account: Account): Promise<"OK"> {
        return actRd.hmset(actKEY.hAccount(account.uid), account as any)
    }

    export async function hgetDetail(uid: string): Promise<Record<string, string>> {
        return actRd.hgetall(actKEY.hAccount(uid))
    }

    export async function scardProjectNum(uid: string): Promise<number> {
        const key = KEYS.Project.zProjectList(uid)
        return actRd.scard(key)
    }

    // chain
    export const chainName = async (chain: string) => {
        return chainRd.hget(chainKEY.hChain(chain), 'name')
    }

    export const chainDetail = async (chain: string) => {
        return chainRd.hgetall(chainKEY.hChain(chain))
    }

    export const setChain = async (chain: ChainConfig) => {
        return chainRd.hmset(chainKEY.hChain(chain.name), chain)
    }

    export const delChain = async (chain: string) => {
        return chainRd.del(chainKEY.hChain(chain))
    }

    export const incrChainNum = async () => {
        return chainRd.incr(chainKEY.chainNum())
    }

    export const decrChainNum = async () => {
        return chainRd.decr(chainKEY.chainNum())
    }

    export const zaddChain = async (score: number, chain: string) => {
        return chainRd.zadd(chainKEY.zChainList(), score, chain.toLowerCase())
    }

    export const zremChain = async (chain: string) => {
        return chainRd.zrem(chainKEY.zChainList(), chain)
    }

    export const zrangeChain = async () => {
        return chainRd.zrange(chainKEY.zChainList(), 0, -1)
    }

    export const publishTopic = async (topic: Topic, chain: string) => {
        return chainRd.publish(topic, chain)
    }

    // project
    export const hgetProject = async (chain: string, pid: string) => {
        return projRd.hmget(proKEY.hProject(chain, pid), 'uid', 'bwDayLimit', 'reqDayLimit')
    }
}

export default Rd