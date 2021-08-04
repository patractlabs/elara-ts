import { getAppLogger, PResultT, Ok, ChainConfig, isErr, Err } from '@elara/lib'
import Dao from '../dao'
import ChainModel, { ChainAttr ,Network} from '../models/chain'
import { FindOptions } from 'sequelize/types'
import { errMsg } from '../util'
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

        try {
            log.debug('add new chain: %o', chain)
            Dao.publishTopic(Topic.ChainAdd, chain.name)
            const re = await ChainModel.create({
                ...chain,
            }) 
            return Ok(re)
        } catch (err) {
            log.error('create project error: ', err)
            return Err(errMsg(err, 'create error'))
        }

        // let re = await ChainModel.create(chain)
        // log.info('add chain result: ', re)

        // // publish newchain event
        // Dao.publishTopic(Topic.ChainAdd, chain.name)
        // return Ok(re)
    }

    export const deleteChain = async (name: string,force: boolean = false): PResultT<boolean> => {
        try {
            const re = await ChainModel.destroy({
                where: {
                    name 
                },
                force
            })

            await Dao.publishTopic(Topic.ChainDel, name)
            await Dao.delChain(name)
            return Ok(re === 1)
        } catch (err) {
            log.error(`delete chain ${name} error: %o`, err)
            return Err(errMsg(err, 'delete error'))
        }
        // const re = await Dao.delChain(chain)
        // log.warn('delete result: ', re)

        // // publish chain delete event
        // await Dao.publishTopic(Topic.ChainDel, chain)
        // return Ok(re)
    }

    export const updateChain = async (chain: ChainConfig): PResultT<string | number> => {
        const re = await Dao.updateChain(chain)
        return re
    }

    export const findByNetwork = async (network: Network): PResultT<ChainAttr[]> => {
        try {
            const re = await ChainModel.findAll({
                where: { network },
            })
            if (re === null) {
                return Err(`no ${network} chain `)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find ${network} chain ,error: `, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    export const chainList = async (): PResultT<ChainAttr[]> => {
        try {
            const option: FindOptions<ChainAttr> = {}
            const re = await ChainModel.findAll(option)
            return Ok(re)
        } catch (err) {
            log.error(`find chain  error: `, err)
            return Err(errMsg(err, 'find error'))
        }
        // const re = await Dao.getChainList()
        // return Ok(re)
    }
}

export default Chain