import { getAppLogger, randomId, Err, Ok, PResultT, KEYS } from '@elara/lib'
import ProjectModel, { ProAttr, ProStatus } from '../models/project'
import { errMsg } from '../util'
import { Sequelize } from 'sequelize-typescript'
import { FindOptions } from 'sequelize/types'
import User from '../models/user'
import { ProRd, UserRd, StatRd } from '../redis'
import Stat from './stat'
import { StatT } from '../interface'

const KEY = KEYS.Project

const log = getAppLogger('project-service')

interface ProInfo extends ProAttr {
    stat: StatT
}

class Project {

    static async create(pro: ProAttr): PResultT<ProAttr> {
        try {
            const chain = pro.chain.toLowerCase()
            const pid = randomId()
            const re = await ProjectModel.create({
                ...pro,
                chain,
                pid,
                secret: randomId(),
                status: ProStatus.Active,
            })
            ProRd.hmset(KEY.hProjectStatus(chain, pid), 'status', 'active', 'user', pro.userId)
            return Ok(re)
        } catch (err) {
            log.error('create project error: %o', err)
            return Err(errMsg(err, 'create error'))
        }
    }

    static async delete(id: number, force: boolean = false): PResultT<boolean> {
        try {
            const pro = await ProjectModel.findOne({
                where: { id },
                paranoid: !force
            })
            if (pro === null) {
                log.error(`delete project error: no this project ${id}`)
                return Ok(true)
            }

            const re = await ProjectModel.destroy({
                where: {
                    id
                },
                force
            })
            if (re === 1) {
                const { chain, pid } = pro
                log.warn(`start to clear ${chain} project[${pid}] statistic record`)
                // clear project status key
                await ProRd.del(KEY.hProjectStatus(pro.chain, pro.pid))

                const stream = StatRd.scanStream({
                    match: `*${chain.toLowerCase()}_${pid}*`
                })
                stream.on('data', (keys: string[]) => {
                    log.warn(`start to clear ${chain} project[${pid}] keys: %o`, keys)
                    keys.forEach(key => {
                        StatRd.unlink(key)
                    })
                })

                stream.on('end', () => {
                    log.info(`all statistic record be cleared of ${chain} project[${pid}]`)
                })
            }
            return Ok(re === 1)
        } catch (err) {
            log.error(`delete project ${id} error: %o`, err)
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
            log.error(`update project ${pro.id} error: %o`, err)
            return Err(errMsg(err, 'update error'))
        }
    }

    static async updateLimit(pro: ProAttr): PResultT<[number, ProAttr[]]> {
        try {
            const prom = await ProjectModel.findOne({
                where: { id: pro.id },
                include: [User]
            })
            if (prom === null || prom.chain === undefined || prom.pid === undefined) {
                log.error(`update limit error: invalid project [${pro.id}]`)
                return Err(`invalid project [${pro.id}]`)
            }

            // fetch current usage
            const stat = await Stat.proStatDaily(prom.chain, prom.pid)
            log.debug(`project user info: %o `, prom)
            if (prom.status === 'active') {
                log.debug(`into projec limit update, current status active`)
                if ((pro.reqDayLimit && pro.reqDayLimit <= stat.reqCnt) ||
                    (pro.bwDayLimit && pro.bwDayLimit <= stat.bw)) {
                    // set suspend
                    pro.status = 'suspend' as ProStatus
                    // update redis cache
                    ProRd.hset(KEY.hProjectStatus(prom.chain, prom.pid), 'status', 'suspend')
                }
            } else if (prom.status === 'suspend') {
                log.debug(`into projec limit update, current status suspend`)

                // check if user status is ok
                const ustat = await UserRd.hget(KEYS.User.hStatus(prom.userId), 'status')
                log.debug(`user status of project[${pro.id}]: ${ustat}`)

                const userStatOk = ustat === 'active'
                if (userStatOk &&
                    ((pro.reqDayLimit && pro.reqDayLimit >= stat.reqCnt) ||
                        (pro.bwDayLimit && pro.bwDayLimit <= stat.bw))) {
                    pro.status = 'active' as ProStatus
                    // update cache
                    ProRd.hset(KEY.hProjectStatus(prom.chain, prom.pid), 'status', 'active')
                }
            }
            log.debug(`project limit to update: %o`, pro)
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
            chain = chain.toLowerCase()
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
            chain = chain.toLowerCase()
            const re = await ProjectModel.findOne({
                where: { chain, pid },
                attributes: ['status', 'reqSecLimit', 'reqDayLimit', 'bwDayLimit'],
                include: includeUser ? [User] : undefined
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

    static async listWithStatusByUser(userId: number, chain?: string): PResultT<ProInfo[]> {
        try {
            const option: FindOptions<ProAttr> = {
                where: { userId },
                order: [Sequelize.col('id')]
            }

            if (chain) {
                option.where = { ...option.where, chain }
            }
            const re = await ProjectModel.findAll(option)
            let res: ProInfo[] = []
            for (let pro of re) {
                const re = await Stat.proStatDaily(pro.chain, pro.pid)
                let ptmp = { ...(pro as any)['dataValues'] } as ProInfo
                ptmp.stat = re
                // log.debug(`project info temp: %o`, ptmp)
                res.push(ptmp)
            }
            log.debug(`${chain} project info list of user[${userId}]: %o`, res)
            return Ok(res)
        } catch (err) {
            log.error(`find projects of user[${userId}] error: %o`, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async listOfUser(userId: number, short: boolean = false): PResultT<ProAttr[]> {
        try {
            const option: FindOptions<ProAttr> = { where: { userId }, order: [Sequelize.col('chain')] }
            if (short) { option.attributes = ['id', 'name', 'chain', 'status', 'pid'] }
            const re = await ProjectModel.findAll(option)
            return Ok(re)
        } catch (err) {
            log.error(`get project list of user[${userId}] error: %o`, err)
            return Err(errMsg(err, `project list of user[${userId}] error`))
        }
    }

    // count 
    static async countOfChain(chain: string): PResultT<number> {
        try {
            chain = chain.toLowerCase()
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
            // log.debug(`project count of user ${userId}: %o`, re)
            if (byChain) {
                return Ok(re)
            }

            return Ok(parseInt((re[0] as any).dataValues.count))
        } catch (err) {
            log.error('query project count of user error: %o', err)
            return Err(errMsg(err, 'query error'))
        }
    }

    static async isExist(userId: number, chain: string, name: string): Promise<boolean> {
        log.debug('Info project exist check: %o %o %o', userId, chain, name)
        try {
            chain = chain.toLowerCase()
            const re = await ProjectModel.findOne({
                where: { userId, chain, name },
                attributes: ['name']
            })
            log.debug(`project name of user[${userId}]${chain}: ${name}`)
            if (re !== null) {
                log.debug(`duplicate project name ${name} `)
                return true
            }
        } catch (err) {
            log.error('Project exist check error: %o', err)
            return true
        }
        return false
    }
}

export default Project