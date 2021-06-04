/// chain list init and handler the chain update

import { getAppLogger, isErr, PVoidT } from 'lib'
import Dao, { chainPSub } from '../src/dao'
import G from './global'
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
        G.initChains([])
        return
    }
    // log.info('chain list: ', chains)
    G.initChains(chains.value)
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

    export const parseConfig = async (chain: string) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.error(`Parse config of chain[${chain}] error: `, conf.value)
            return 
        }
        // what if json parse error
        // G.chainConf[chain] = {
        //     ...conf.value,
        //     extends: JSON.parse(conf.value.extends),
        //     excludes: JSON.parse(conf.value.excludes)
        // }
        // log.warn('chain conf: ', G.chainConf[chain])
    }

    export const init = async () => {
        return fetchChains()
        // let parses: Promise<void>[] = []
        // const chains = G.getChains()
        // log.warn('parse chain: ', chains)
        // for (let c of chains) {
        //     parses.push(parseConfig(c))
        // }
        // return Promise.all(parses)
    }
}

export default Chain