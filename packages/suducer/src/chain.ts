/// chain list init and handler the chain update

import { ChainConfig, getAppLogger, PVoidT } from '@elara/lib'
import { isErr } from '@elara/lib'
import Dao from './dao'
import { G } from './global'
import Conf from '../config'
const log = getAppLogger('chain')
import { Redis, DBT } from '@elara/lib'

const redisConf = Conf.getRedis()
const pubsubRd = new Redis(DBT.Pubsub, {
    host: redisConf.host, port: redisConf.port, options: {
        password: redisConf.password
    }
})
const PSuber = pubsubRd.getClient()

pubsubRd.onConnect(() => {
    log.info('redis db pubsub connectino open')
})

pubsubRd.onError((err: string) => {
    log.error(`redis db pubsub conection error: ${err}`)
    process.exit(1)
})

enum Topic {
    ChainAdd = 'chain-add',
    ChainDel = 'chain-del',
    ChainUpdate = 'chain-update'
}

// chain events
async function chainAddHandler(chain: string): PVoidT {
    log.info('Into chain add handler: %o', chain)
    // TODO: chain-init logic
    // update G.chain G.chainConf
    // 
}

async function chainDelHandler(chain: string): PVoidT {
    log.info('Into chain delete handler: %o', chain)
    // TODO
}

async function chainUpdateHandler(chain: string): PVoidT {
    log.info('Into chain update handler: %o', chain)
    // TODO
    // update G.chain G.chainConf
}

// pattern subscription
PSuber.psubscribe('*', (err, topicNum) => {
    log.info('psubscribe all chain event topic!', err, topicNum)
})

PSuber.on('pmessage', (_pattern, chan, chain: string) => {
    log.info('received new topic message: %o', chan)
    switch (chan) {
        case Topic.ChainAdd:
            log.info('Topic chain message: %o', chain)
            chainAddHandler(chain)
            break
        case Topic.ChainDel:
            log.info('Chain delete message: %o', chain)
            chainDelHandler(chain)
            break
        case Topic.ChainUpdate:
            log.info('chain update message: %o', chain)
            chainUpdateHandler(chain)
            break
        default:
            log.info(`Unknown topic [${chan}] message: %o`, chain)
            break
    }
})

class Chain {

    static async parseConfig(chain: string, serverId: number) {
        const conf = await Dao.getChainConfig(chain, serverId)
        if (isErr(conf)) {
            log.error(`Parse config of chain[${chain}] error: %o`, conf.value)
            return
        }
        const chainf = conf.value as ChainConfig

        G.addChain(chainf)
    }

    static async init() {
        let re = await Dao.getChainList()
        if (isErr(re)) {
            log.error(`fetch chain list error: ${re.value}`)
            process.exit(2)
        }
        const chains = re.value
        let parses: Promise<void>[] = []
        log.warn('fetch chain list: %o', chains)

        for (let c of chains) {
            try {
                const ids = await Dao.getChainIds(c)
                if (ids.length === 0) {
                    log.error(`get ${c} id list error: empty`)
                    process.exit(1)
                }
                for (let id of ids) {
                    parses.push(Chain.parseConfig(c, parseInt(id)))
                }
            } catch (err) {
                log.error(`catch init ${c} config error: %o`, err)
                process.exit(2)
            }
        }
        return Promise.all(parses)
    }
}

export = Chain