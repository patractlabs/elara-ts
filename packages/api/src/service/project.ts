import { getAppLogger, randomId, Err, Ok, PResultT } from '@elara/lib'
import ProjectModel, { ProAttr, ProStatus } from '../models/project'
import User from '../models/user'
import { errMsg } from '../util'
import { Sequelize } from 'sequelize-typescript'
import { FindOptions } from 'sequelize/types'

const log = getAppLogger('project-service')

class Project {

    static async create(githubId: string, pro: ProAttr): PResultT<ProAttr> {
        try {
            const user = await User.findOne({ where: { githubId }, attributes: ['id'] })
            if (user === null) {
                return Err('invalid user')
            }
            const re = await ProjectModel.create({
                ...pro,
                pid: randomId(),
                secret: randomId(),
                status: ProStatus.Active,
                userId: user.id
            })
            return Ok(re)
        } catch (err) {
            log.error('create project error: ', err)
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
            log.error(`delete project ${id} error: `, err)
            return Err(errMsg(err, 'delete error'))
        }
    }

    static async update(pro: ProAttr): PResultT<[number, ProjectModel[]]> {
        try {
            const re = await ProjectModel.update(pro, {
                where: { id: pro.id }
            })
            return Ok(re)
        } catch (err) {
            log.error(`update project ${pro.id} error: `, err)
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
            log.error(`find project ${id} error: `, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async findByChainPid(chain: string, pid: string): PResultT<ProAttr> {
        try {
            const re = await ProjectModel.findOne({
                where: { chain, pid }
            })
            if (re === null) {
                return Err(`no ${chain} project ${pid}`)
            }
            return Ok(re)
        } catch (err) {
            log.error(`find ${chain} project ${pid} error: `, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async list(userId?: number, chain?: string): PResultT<ProAttr[]> {
        try {
            const re = await ProjectModel.findAll({
                where: { userId, chain }
            })
            return Ok(re)
        } catch (err) {
            log.error(`find projects of user[${userId}] ${chain} error: `, err)
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
            log.debug(`project count of chain ${chain}: `, re)
            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
            return Err(errMsg(err, 'query error'))
        }
    }

    static async countOfUser(userId: number, byChain: boolean = false): PResultT<number> {
        try {
            const option: FindOptions<ProAttr> = {
                where: { userId },
                attributes: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            }
            if (byChain) {
                option.group = Sequelize.col('chain')
            }
            const re = await ProjectModel.findAll(option)
            log.debug(`project count of user ${userId}: `, re)
            // TODO
            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
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
            log.debug(`project count of user ${userId} by chain: `, re)
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