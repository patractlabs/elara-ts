import { getAppLogger, PResultT, Ok, Err } from '@elara/lib'
import ChainModel, { ChainAttr, Network } from '../models/chain'
import { errMsg } from '../util'
import { Sequelize } from 'sequelize-typescript'
const log = getAppLogger('chain')

class Chain {

    static async findByName(name: string): PResultT<ChainAttr> {
        try {
            const re = await ChainModel.findOne({
                where: { name }
            })
            if (re === null) {
                return Err(`no chain name ${name}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find chain ${name} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }

    }

    static async findById(id: number): PResultT<ChainAttr> {
        try {
            const re = await ChainModel.findOne({
                where: { id }
            })
            if (re === null) {
                return Err(`no chain ${id}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find chain ${id} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }

    }

    static async newChain(chain: ChainAttr): PResultT<ChainAttr> {

        try {
            log.debug('add new chain: %o', chain)
            const re = await ChainModel.create({
                ...chain,
            })
            return Ok(re)
        } catch (err) {
            log.error('create chain error: %o', err)
            return Err(errMsg(err, 'create error'))
        }
    }

    static async deleteChain(id: number, name: string, force: boolean = false): PResultT<boolean> {
        try {
            const re = await ChainModel.destroy({
                where: { id },
                force
            })
            log.warn(`chain ${name} deleted, force: ${force}`)
            return Ok(re === 1)
        } catch (err) {
            log.error(`delete chain ${name} error: %o`, err)
            return Err(errMsg(err, 'delete error'))
        }
    }

    static async findByNetwork(network: Network): PResultT<ChainAttr[]> {
        try {
            const re = await ChainModel.findAll({
                where: { network },
            })
            return Ok(re)
        } catch (err) {
            log.error(`find ${network} chain ,error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async chainList(): PResultT<Record<string, ChainAttr[]>> {
        try {
            const re = await ChainModel.findAll({
                order: [Sequelize.col('network')]
            })
            let network = ''
            let chains: Record<string, ChainAttr[]> = {}
            let chainLis: ChainAttr[] = []
            // group by network
            re.map(async (chain: ChainModel) => {
                if (chain.network === network) {
                    chainLis.push(chain)
                } else {
                    if (network !== '') {
                        chains[network] = chainLis
                        chainLis = []
                        network = chain.network
                    } else {
                        network = chain.network
                        chainLis.push(chain)
                    }
                }
            })
            chains[network] = chainLis
            return Ok(chains)
        } catch (err) {
            log.error(`find chain  error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }
}

export default Chain