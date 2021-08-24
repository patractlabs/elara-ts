/// chain list init and handler the chain update

import { ChainConfig, getAppLogger, PVoidT } from '@elara/lib'
import { isErr } from '@elara/lib'
import Dao from './dao'
import { G } from './global'
import Conf from '../config'
const log = getAppLogger('chain')
import { Redis, DBT } from '@elara/lib'

const redisConf = Conf.getRedis()
const pubsubRd = new Redis(DBT.Pubsub, {host: redisConf.host, port: redisConf.port, options:{
    password:redisConf.password
}})
const PSuber = pubsubRd.getClient()

pubsubRd.onConnect(() => {
    log.info('redis db pubsub connectino open')
})

pubsubRd.onError((err: string) => {
    log.error(`redis db pubsub conection error: ${err}`)
    process.exit(1)
})

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

// chain events
const chainAddHandler = async (chain: string): PVoidT => {
    log.info('Into chain add handler: %o', chain)
    // TODO: chain-init logic
    // update G.chain G.chainConf
    // 
}

const chainDelHandler = async (chain: string): PVoidT => {
    log.info('Into chain delete handler: %o', chain)
    // TODO
}

const chainUpdateHandler = async (chain: string): PVoidT => {
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
    switch(chan) {
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

namespace Chain {

    export const parseConfig = async (chain: string, serverId: number) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.error(`Parse config of chain[${chain}] error: %o`, conf.value)
            return 
        }
        const chainf = conf.value as ChainConfig
        if (chainf.serverId != serverId) { 
            log.warn(`chain ${chain} serveId[${chainf.serverId}] not match, current server ID ${serverId}`)
            return 
        }
        G.addChain(chainf)
    }

    export const init = async () => {
        let re = await Dao.getChainList()
        if (isErr(re)) {
            log.error(`fetch chain list error: ${re.value}`)
            process.exit(2)
        }
        const chains = re.value
        let parses: Promise<void>[] = []
        log.warn('fetch chain list: %o', chains)

        const server = Conf.getServer()
        for (let c of chains) {
            parses.push(parseConfig(c, server.id))
        }
        return Promise.all(parses)
    }
}

export = Chain