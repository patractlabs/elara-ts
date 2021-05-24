/// chain list init and handler the chain update

import { chainRd } from '../db/redis'
import { KEYS, getAppLogger } from 'lib'
import { G } from './global'
const KEY = KEYS.Chain
const log = getAppLogger('sub-chain', true)

export const fetchChains = async () => {
    let chains = await chainRd.zrange(KEY.zChainList(), 0, -1)
    log.info('chain list: ', chains)
    G.chains = chains
}

export enum Topic {
    Chain = 'chain',
}


// chainRd.subscribe(Topic.Chain, (err, msg) => {
//     log.info(err, msg)
// })

// pattern subscription
chainRd.psubscribe('*', (err, msg) => {
    log.info('psubscribe all topic!', err, msg)
})

chainRd.on('pmessage', (pat, chan, msg) => {
    log.info('received new topic message: ', chan)
    switch(chan) {
        case Topic.Chain:
            log.info('Topic chain message: ', msg)
            break
        default:
            log.info(`Unknown topic [${chan}] message: `, msg)
            break
    }
})


chainRd.on('error', (err) => {
    log.error('Redis sub listener error: ', err)
})

// pattern

const parseChainConfig = async (chain: string) => {
    let key = KEY.hChain(chain)
    let exs = await chainRd.hmget(key, ['extends', 'excludes'])

    let extens = []
    let excludes= []
    if (exs[0] !== null) {
        extens = JSON.parse(exs[0])
        for (let e in extens) {
            log.info(e, extens[e])
        }
    }

    if (exs[1] !== null) {
        excludes = JSON.parse(exs[1])
        for (let e of excludes) {
            log.info(e)
        }
    }
}
import { dotenvInit } from 'lib'
dotenvInit()
import Conf from 'config'
log.info('config in esuber: ', Conf.get("redis"))
