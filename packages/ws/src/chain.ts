/// chain list init and handler the chain update

import { ChainConfig, getAppLogger, PVoidT } from 'lib'
import { isErr } from 'lib'
import Dao, { chainPSub } from './dao'
import Conf from '../config'
const log = getAppLogger('chain', true)

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
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
    export namespace G {
        const Chains: Set<string> = new Set()
        const ChainConf: {[key in string]: ChainConfig} = {}

        export const addChainConf = (chainConf: ChainConfig): void => {
            ChainConf[chainConf.name] = chainConf
        }

        // chains
        export const addChain = (chain: string): Set<string> => {
            return Chains.add(chain)
        }

        export const delChain = (chain: string): boolean => {
            return Chains.delete(chain)
        }

        export const getChains = (): Set<string> => {
            return Chains
        }

        export const hasChain = (chain: string): boolean => {
            return Chains.has(chain)
        }
    }

    export const parseConfig = async (chain: string, serverId: number) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.error(`Parse config of chain[${chain}] error: `, conf.value)
            return 
        }
        const chainf = conf.value as ChainConfig
        if (chainf.serverId != serverId) { 
            log.warn(`chain ${chain} serveId[${chainf.serverId}] not match, current server ID ${serverId}`)
            return 
        }
        G.addChain(chain)
    }

    export const init = async () => {
        let re = await Dao.getChainList()
        if (isErr(re)) {
            log.error(`fetch chain list error: ${re.value}`)
            process.exit(2)
        }
        const chains = re.value
        let parses: Promise<void>[] = []
        log.warn('fetch chain list: ', chains)

        const server = Conf.getServer()
        for (let c of chains) {
            parses.push(parseConfig(c, server.id))
        }
        return Promise.all(parses)
    }
}

export = Chain