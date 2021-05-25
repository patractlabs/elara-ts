import { KEYS, getAppLogger, PResultT, Ok, ChainConfig } from 'lib'
import { chainRd } from '../db/redis'

const KEY = KEYS.Chain
const log = getAppLogger('chain', true)

enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

namespace Chain {
    // TODO error handle
    
    export const isExist = async (chain: string): Promise<Boolean> => {
        const name = await chainRd.hget(KEY.hChain(chain), 'name')
        if (name === null) {
            log.info('No this chain: ', name)
            return false
        }
        if (name.toLowerCase() === chain.toLowerCase()) {
            return true
        }
        return false
    }
    
    export const detail = async (chain: string): PResultT => {
        const re: any = await chainRd.hgetall(KEY.hChain(chain))
        let cha: ChainConfig = {            
            ...re,
            name: chain,
            baseUrl: re.baseUrl,
            excludes: JSON.parse(re.excludes),
            extends: JSON.parse(re.extends),
        }
        return Ok(cha)
    }
    
    export const newChain = async (chain: ChainConfig): PResultT => {
        let re = await chainRd.hmset(KEY.hChain(chain.name), chain)
        log.info('add chain result: ', re)
        let cnt = await chainRd.incr(KEY.chainNum())
        chainRd.zadd(KEY.zChainList(), cnt, chain.name.toLowerCase())

        // publish newchain event
        chainRd.publish(Topic.ChainAdd, chain.name)
        return Ok(re)
    }
    
    export const deleteChain = async (chain: string): PResultT => {
        const re = await chainRd.del(KEY.hChain(chain))
        log.warn('delete result: ', re)
        await chainRd.zrem(KEY.zChainList(), chain)
        await chainRd.decr(KEY.chainNum())

        // publish chain delete event
        await chainRd.publish(Topic.ChainDel, chain)
        return Ok(re)
    }

    export const updateChain = async (chain: ChainConfig): PResultT => {
        const re = await chainRd.hmset(KEY.hChain(chain.name), chain)
        return Ok(re)
    }   

    export const chainList = async (): PResultT => {
        const re = await chainRd.zrange(KEY.zChainList(), 0, -1)
        return Ok(re)
    }
}

export = Chain