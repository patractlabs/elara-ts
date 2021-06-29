/// chain list init and handler the chain update

import { ChainConfig, getAppLogger, isErr, PVoidT, RpcMethods } from 'lib'
import Dao, { chainPSub } from './dao'
import { G } from './global'
import Conf from '../config'
const log = getAppLogger('chain', true)

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

const fetchChains = async (): PVoidT => {
    let chains = await Dao.getChainList()
    if (isErr(chains)) {
        log.error('Fetch chains error: ', chains.value)
        G.chains = []
        return
    }
    // log.info('chain list: ', chains)
    G.chains = chains.value
    G.rpcs = RpcMethods
}

// chain events
const chainAddHandler = async (chain: string): PVoidT => {
    log.info('Into chain add handler: ', chain)
    // TODO: chain-init logic
    // update G.chain G.chainConf
    // 
}

const chainDelHandler = async (chain: string): PVoidT => {
    log.info('Into chain delete handler: ', chain)
    // TODO
}

const chainUpdateHandler = async (chain: string): PVoidT => {
    log.info('Into chain update handler: ', chain)
    // TODO
    // update G.chain G.chainConf
}

// pattern subscription
chainPSub.psubscribe('*', (err, topicNum) => {
    log.info('psubscribe all chain event topic!', err, topicNum)
})

chainPSub.on('pmessage', (_pattern, chan, chain: string) => {
    log.info('received new topic message: ', chan)
    switch(chan) {
        case Topic.ChainAdd:
            log.info('Topic chain message: ', chain)
            chainAddHandler(chain)
            break
        case Topic.ChainDel:
            log.info('Chain delete message: ', chain)
            chainDelHandler(chain)
            break
        case Topic.ChainUpdate:
            log.info('chain update message: ', chain)
            chainUpdateHandler(chain)
            break
        default:
            log.info(`Unknown topic [${chan}] message: `, chain)
            break
    }
})

chainPSub.on('error', (err) => {
    log.error('Redis chain-server listener error: ', err)
})

namespace Chain {

    export const parseConfig = async (chain: string, serverId: number) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.error(`Parse config of chain[${chain}] error: `, conf.value)
            return 
        }
        const chainf = conf.value as ChainConfig
        if (chainf.serverId != serverId) { 
            log.warn(`chain serveId[${chainf.serverId}] not match, current server ID ${serverId}`)
            return 
        }
        // what if json parse error
        G.addChain(chainf)
        log.warn('chain conf: ', chainf)
    }

    export const init = async () => {
        await fetchChains()
        let parses: Promise<void>[] = []
        log.warn('parse chain: ', G.chains)
        const server = Conf.getServer()
        for (let c of G.chains) {
            parses.push(parseConfig(c, server.id))
        }
        return Promise.all(parses)
    }
}

export = Chain