/// chain list init and handler the chain update

import { KEYS, getAppLogger, ChainConfig, RpcMethods } from 'lib'
import Rd, { chainPSub } from '../db/redis'
import { G } from './global'
const KEY = KEYS.Chain
const log = getAppLogger('sub-chain', true)

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

const fetchChains = async () => {
    let chains = await Rd.getChainList()
    // log.info('chain list: ', chains)
    G.chains = chains
    G.rpcs = RpcMethods
}

// chain events
const chainAddHandler = async (chain: string) => {
    log.info('Into chain add handler: ', chain)
    // TODO: chain-init logic
    // update G.chain G.chainConf
    // 
}

const chainDelHandler = async (chain: string) => {
    log.info('Into chain delete handler: ', chain)
    // TODO
}

const chainUpdateHandler = async (chain: string) => {
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
        let conf: any = await Rd.getChainConfig(chain)
    
        // what if json parse error
        G.chainConf[chain] = {
            ...conf,
            extends: JSON.parse(conf.extends),
            excludes: JSON.parse(conf.excludes)
        }
        // log.warn('chain conf: ', G.chainConf[chain])
    }

    export const init = async () => {
        await fetchChains()
        let parses: Promise<void>[] = []
        for (let c of G.chains) {
            parses.push(parseConfig(c))
        }
        return Promise.all(parses)
    }
}

export = Chain