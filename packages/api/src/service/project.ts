import { getAppLogger, randomId, Err, Ok, PResultT } from '@elara/lib'
import ProjectModel, { ProAttr, ProStatus } from '../models/project'
import { errMsg } from '../util'
// import { Op } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { FindOptions } from 'sequelize/types'
import User from '../models/user'

const log = getAppLogger('project-service')

class Project {

    static async create(pro: ProAttr): PResultT<ProAttr> {
        try {
            log.debug('create new project: ', pro)

            const re = await ProjectModel.create({
                ...pro,
                pid: randomId(),
                secret: randomId(),
                status: ProStatus.Active,
            })
            return Ok(re)
        } catch (err) {
            log.error('create project error: %o', err)
            return Err(errMsg(err, 'create error'))
        }
    }

    static async delete(id: number, force: boolean = false): PResultT<boolean> {
        try {
            const re = await ProjectModel.destroy({
                where: {
                    id
                },
                force
            })
            return Ok(re === 1)
        } catch (err) {
            log.error(`delete project ${id} error: %o`, err)
            return Err(errMsg(err, 'delete error'))
        }
    }

    static async update(pro: ProAttr): PResultT<[number, ProjectModel[]]> {
        try {
            // update limit
            const re = await ProjectModel.update(pro, {
                where: { id: pro.id }
            })
            return Ok(re)
        } catch (err) {
            log.error(`update project ${pro.id} error: %o`, err)
            return Err(errMsg(err, 'update error'))
        }
    }

    static async findById(id: number): PResultT<ProAttr> {
        try {
            const re = await ProjectModel.findOne({
                where: { id }
            })
            if (re === null) {
                return Err(`no project ${id}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find project ${id} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async findByChainPid(chain: string, pid: string): PResultT<ProAttr> {
        try {
            const re = await ProjectModel.findOne({
                where: { chain, pid },
            })
            if (re === null) {
                return Err(`no ${chain} project ${pid}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find ${chain} project ${pid} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async statusByChainPid(chain: string, pid: string, includeUser: boolean = false): PResultT<ProAttr> {
        try {
            const re = await ProjectModel.findOne({
                where: { chain, pid },
                attributes: ['status', 'reqSecLimit', 'reqDayLimit', 'bwDayLimit'],
                include: includeUser ? [User]: undefined
            })
            if (re === null) {
                return Err(`no ${chain} project ${pid}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`query status of ${chain} project ${pid} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async list(userId?: number, chain?: string): PResultT<ProAttr[]> {
        try {
            const option: FindOptions<ProAttr> = {}
            // if (userId) { option.where = { [Op.and]: [{ userId }] } }
            // if (chain) { option.where = { [Op.and]: [{ ...option.where, chain }] } }
            if (userId) { option.where = { userId } }
            if (chain) { option.where = { ...option.where, chain } }
            const re = await ProjectModel.findAll(option)
            return Ok(re)
        } catch (err) {
            log.error(`find projects of user[${userId}] ${chain} error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    // count 
    static async countOfChain(chain: string): PResultT<number> {
        try {
            const re = await ProjectModel.findAll({
                where: { chain },
                attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']]
            })
            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
            return Err(errMsg(err, 'query error'))
        }
    }

    static async countOfUser(userId: number, byChain: boolean = false): PResultT<number | ProAttr[]> {
        try {
            const option: FindOptions<ProAttr> = {
                where: { userId },
                attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            }
            if (byChain) {
                option.attributes = ['chain', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']]
                option.group = Sequelize.col('chain')
            }
            const re = await ProjectModel.findAll(option)
            log.debug(`project count of user ${userId}: %o`, re)
            // TODO
            if (byChain) { return Ok(re) }
            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
            log.error('query project count of user error: %o', err)
            return Err(errMsg(err, 'query error'))
        }
    }

    // TODO
    static async countOfUserByChain(userId: number): PResultT<number> {
        try {
            const re = await ProjectModel.findAll({
                where: { userId },
                attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
                group: Sequelize.col('chain')
            })
            log.debug(`project count of user ${userId} by chain: %o`, re)
            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
            return Err(errMsg(err, 'query error'))
        }
    }

    static async isExist(userId: number, chain: string, name: string): Promise<boolean> {
        log.debug('Info project exist check: ', userId, chain, name)
        try {
            const re = await ProjectModel.findOne({
                where: { userId, chain, name },
                attributes: ['name']
            })
            log.debug(`project name of user[${userId}]${chain}: `, name)
            if (re !== null) {
                log.debug(`duplicate project name ${name} `)
                return true
            }
        } catch (e) {
            log.error('Project exist check error: ', e)
            return true
        }
        return false
    }
}

export default Project