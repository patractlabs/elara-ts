import { getAppLogger, PResultT, Ok, ChainConfig, isErr } from 'lib'
import Dao from '../dao'
import { Topic } from '../types'

const log = getAppLogger('chain', true)

namespace Chain {
    // TODO error handle
    
    export const isExist = async (chain: string): Promise<Boolean> => {
        const re = await Dao.getChainName(chain)
        if (isErr(re)) {
            log.info('No this chain: ', re.value)
            return false
        }
        if (re.value.toLowerCase() === chain.toLowerCase()) {
            return true
        }
        return false
    }
    
    export const detail = async (chain: string): PResultT => {
        const re: any = await Dao.getChainDetail(chain)
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
        let re = await Dao.updateChain(chain)
        log.info('add chain result: ', re)

        // publish newchain event
        Dao.publishTopic(Topic.ChainAdd, chain.name)
        return Ok(re)
    }
    
    export const deleteChain = async (chain: string): PResultT => {
        const re = await Dao.delChain(chain)
        log.warn('delete result: ', re)

        // publish chain delete event
        await Dao.publishTopic(Topic.ChainDel, chain)
        return Ok(re)
    }

    export const updateChain = async (chain: ChainConfig): PResultT => {
        const re = await Dao.updateChain(chain)
        return Ok(re)
    }   

    export const chainList = async (): PResultT => {
        const re = await Dao.getChainList()
        return Ok(re)
    }
}

export = Chain