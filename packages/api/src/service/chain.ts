import { getAppLogger, PResultT, Ok, ChainConfig, isErr } from '@elara/lib'
import Dao from '../dao'
import ChainModel, { ChainAttr } from '../models/chain'

const log = getAppLogger('chain')

export enum Topic {
    ChainAdd    = 'chain-add',
    ChainDel    = 'chain-del',
    ChainUpdate = 'chain-update'
}

namespace Chain {
    // TODO error handle

    export const isExist = async (chain: string): Promise<Boolean> => {
        const re = await Dao.getChainName(chain)
        if (isErr(re)) {
            log.info('No this chain: %o', re.value)
            return false
        }
        if (re.value.toLowerCase() === chain.toLowerCase()) {
            return true
        }
        return false
    }

    export const detail = async (chain: string): PResultT<ChainConfig> => {
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

    export const newChain = async (chain: ChainAttr): PResultT<ChainAttr> => {
        let re = await ChainModel.create(chain)
        log.info('add chain result: %o', re)

        // publish newchain event
        Dao.publishTopic(Topic.ChainAdd, chain.name)
        return Ok(re)
    }

    export const deleteChain = async (chain: string): PResultT<void> => {
        const re = await Dao.delChain(chain)
        log.warn('delete result: %o', re)

        // publish chain delete event
        await Dao.publishTopic(Topic.ChainDel, chain)
        return Ok(re)
    }

    export const updateChain = async (chain: ChainConfig): PResultT<string | number> => {
        const re = await Dao.updateChain(chain)
        return re
    }

    export const chainList = async (): PResultT<string[]> => {
        const re = await Dao.getChainList()
        return Ok(re)
    }
}

export default Chain