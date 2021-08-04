/// chain list init and handler the chain update

import { getAppLogger, PVoidT, PResultT } from '@elara/lib'
import Conf from '../config'
import Dao, { chainPSub } from '../src/dao'
import G from './global'
import Suber from './suber'
const log = getAppLogger('chain')

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

// chain events
const chainAddHandler = async (chain: string): PVoidT => {
    log.info('Into chain add handler: %o', chain)

    // reinit subers of chain 
    const wsConf = Conf.getWs()
    Suber.initChainSuber(chain, wsConf.poolSize)
}

const chainDelHandler = async (chain: string): PVoidT => {
    log.info('Into chain delete handler: %o', chain)
    // TODO ?
    G.remChain(chain)
}

const chainUpdateHandler = async (chain: string): PVoidT => {
    log.info('Into chain update handler: %o', chain)
    // TODO
    // nothing to do now
}

// pattern subscription
chainPSub.psubscribe('*', (err: any, topicNum: number) => {
    log.info('psubscribe all chain event topic!', err, topicNum)
})

chainPSub.on('pmessage', (_pattern, chan, chain: string) => {
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
            log.info(`Unknown topic [${chan}] message: ${chain}`)
            break
    }
})

chainPSub.on('error', (err) => {
    log.error('Redis chain-server listener error: %o', err)
})

namespace Chain {

    export const fetchChains = async (): PResultT<string[]> => {
        return Dao.getChainList()
    }
}

export default Chain