/// chain list init and handler the chain update

import { ChainConfig, getAppLogger, PVoidT } from '@elara/lib'
import { isErr } from '@elara/lib'
import Dao from './dao'
import Conf from '../config'
import { Redis, DBT } from '@elara/lib'

const log = getAppLogger('chain')
const rconf = Conf.getRedis()

const pubsubRd = new Redis(DBT.Pubsub, { host: rconf.host, port: rconf.port})
const chainPSub = pubsubRd.getClient()

pubsubRd.onConnect(() => {
    log.info(`redis db pubsub connection open: ${rconf.host}:${rconf.port}`)
})

pubsubRd.onError((err: string) => {
    log.error(`redis db pubsub connectino error: ${err}`)
    process.exit(2)
})

enum ChainEvt {
    Add = 'chain-add',
    Del = 'chain-del',
    Update = 'chain-update'
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
chainPSub.psubscribe('*', (err, topicNum) => {
    log.info('psubscribe all chain event topic!', err, topicNum)
})

chainPSub.on('pmessage', (_pattern, chan, chain: string) => {
    log.info('received new topic message: %o', chan)
    switch (chan) {
        case ChainEvt.Add:
            log.info('Topic chain message: %o', chain)
            chainAddHandler(chain)
            break
        case ChainEvt.Del:
            log.info('Chain delete message: %o', chain)
            chainDelHandler(chain)
            break
        case ChainEvt.Update:
            log.info('chain update message: %o', chain)
            chainUpdateHandler(chain)
            break
        default:
            log.info(`Unknown topic [${chan}] message: %o`, chain)
            break
    }
})

chainPSub.on('error', (err) => {
    log.error('Redis chain-server listener error: %o', err)
})

class Chain {
    private static chains: Set<string> = new Set()
    private static conf: Record<string, ChainConfig> = {}

    static addChainConf(chainConf: ChainConfig): void {
        Chain.conf[chainConf.name] = chainConf
    }

    // chains
    static addChain(chain: string): Set<string> {
        return Chain.chains.add(chain)
    }

    static delChain(chain: string): boolean {
        return Chain.chains.delete(chain)
    }

    static getChains(): Set<string> {
        return Chain.chains
    }

    static hasChain(chain: string): boolean {
        return Chain.chains.has(chain)
    }
    // }

    static parseConfig = async (chain: string, serverId: number) => {
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
        Chain.addChain(chain)
    }

    static init = async () => {
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
            parses.push(Chain.parseConfig(c, server.id))
        }
        return Promise.all(parses)
    }
}

export default Chain