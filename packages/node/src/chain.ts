/// chain list init and handler the chain update

import { getAppLogger, PVoidT, PResultT } from 'lib'
import Conf from '../config'
import Dao, { chainPSub } from '../src/dao'
import G from './global'
import Suber from './suber'
const log = getAppLogger('sub-chain', true)

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

// chain events
const chainAddHandler = async (chain: string): PVoidT => {
    log.info('Into chain add handler: ', chain)

    // reinit subers of chain 
    const wsConf = Conf.getWs()
    Suber.initChainSuber(chain, wsConf.poolSize)
}

const chainDelHandler = async (chain: string): PVoidT => {
    log.info('Into chain delete handler: ', chain)
    // TODO ?
    G.remChain(chain)
}

const chainUpdateHandler = async (chain: string): PVoidT => {
    log.info('Into chain update handler: ', chain)
    // TODO
    // nothing to do now
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

    export const fetchChains = async (): PResultT => {
        return Dao.getChainList()
    }
}

export default Chain