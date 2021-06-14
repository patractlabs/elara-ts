/// chain list init and handler the chain update

import { getAppLogger, isErr, PVoidT } from 'lib'
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

const fetchChains = async (): PVoidT => {
    let chains = await Dao.getChainList()
    if (isErr(chains)) {
        log.error('Fetch chains error: ', chains.value)
        G.initChains(new Set())
        return
    }
    // log.info('chain list: ', chains)
    G.initChains(new Set(chains.value))
}

// chain events
const chainAddHandler = async (chain: string): PVoidT => {
    log.info('Into chain add handler: ', chain)

    // reinit subers of chain 
    const wsConf = Conf.getWs()
    Suber.initChainSuber(chain, wsConf.poolSize)

    // update G.chain
    G.addChain(chain)
}

const chainDelHandler = async (chain: string): PVoidT => {
    log.info('Into chain delete handler: ', chain)
    // TODO ?
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

    export const init = async () => {
        return fetchChains()
    }
}

export default Chain