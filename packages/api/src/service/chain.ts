import { getAppLogger, PResultT, Ok, Err, isErr } from '@elara/lib'
import ChainModel, { ChainAttr, Network } from '../models/chain'
import { errMsg } from '../util'
import { Sequelize } from 'sequelize-typescript'
import Project from './project'
const log = getAppLogger('chain')


type ChainInfoT = {
    status: 'active' | 'inactive' | 'empty',
    count: number
}

interface ChainInfo extends ChainAttr {
    status: string,
    count: number
}

class Chain {

    static async findByName(name: string): PResultT<ChainAttr> {
        try {
            name = name.toLowerCase()
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
                name: chain.name.toLowerCase()
            })
            return Ok(re)
        } catch (err) {
            log.error('create chain error: %o', err)
            return Err(errMsg(err, 'create error'))
        }
    }

    static async deleteChain(id: number, name: string, force: boolean = false): PResultT<boolean> {
        try {
            name = name.toLowerCase()
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

    static async chainsInfoList(userId: number): PResultT<Record<string, ChainInfo[]>> {
        try {
            const pre = await Chain.chainsInfoOfUser(userId)
            if (isErr(pre)) {
                return pre
            }
            const chainInfo = pre.value
            log.info(`chain info of user[${userId}]: %o`, chainInfo)
            const re = await ChainModel.findAll({
                order: [Sequelize.col('network'), Sequelize.col('id')]
            })

            let network = ''
            let chains: Record<string, ChainInfo[]> = {}
            let chainLis: ChainInfo[] = []
            // group by network
            re.forEach(async (chain: ChainAttr) => {
                const info = { ...((chain as any)['dataValues']) } as ChainInfo
                info.name = info.name.charAt(0).toUpperCase() + info.name.slice(1)  // capitalize
                if (chainInfo[chain.name]) {
                    info.status = chainInfo[chain.name].status
                    info.count = chainInfo[chain.name].count
                } else {
                    info.status = 'empty'
                    info.count = 0
                }

                if (chain.network === network) {
                    chainLis.push(info)
                } else {
                    if (network !== '') {
                        chains[network] = chainLis
                        chainLis = []
                        chainLis.push(info)
                        network = chain.network
                    } else {
                        network = chain.network
                        chainLis.push(info)
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

    static async chainsInfoOfUser(userId: number): PResultT<Record<string, ChainInfoT>> {
        try {
            const cre = await Project.listOfUser(userId, true)
            if (isErr(cre)) {
                log.error('get project list of user error: %o', cre.value)
                return cre
            }
            const pros = cre.value
            let chain = ''
            const chainMap: Record<string, ChainInfoT> = {}
            pros.forEach(async pro => {
                if (pro.chain !== chain) {
                    chain = pro.chain
                    chainMap[chain] = {
                        status: pro.status === 'active' ? 'active' : 'inactive',
                        count: 1
                    }
                } else {
                    chainMap[chain].status = pro.status !== 'active' ? 'inactive' : chainMap[chain].status
                    chainMap[chain].count += 1
                }
            })
            return Ok(chainMap)
        } catch (err) {
            log.error(`get project info of user[${userId}] errorf: %o`, err)
            return Err(errMsg(err, 'query project info of user error'))
        }
    }
}

export default Chain