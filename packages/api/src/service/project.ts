import { IDT, getAppLogger, randomId, Err, Ok, PResultT, KEYS } from '@elara/lib'
import { projRd } from '../dao/redis'
import ProjectModel, { ProAttr, ProStatus } from '../models/project'
import User from '../models/user'
import { errMsg } from '../util'
import { Sequelize } from 'sequelize-typescript'

const KEY = KEYS.Project

projRd.on('connect', () => {
    log.info('Redis connect successfuly')
})

projRd.on('error', (e) => {
    log.error('Redis error: ', e)
})

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
        }catch (err) {
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
        }catch (err) {
            log.error(`find ${chain} project ${pid} error: `, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async findByChain(chain: string): PResultT<ProAttr[]> {
        try {
            const re = await ProjectModel.findAll({
                where: { chain }
            })
            return Ok(re)
        }catch (err) {
            log.error(`find projects of ${chain} error: `, err)
            return Err(errMsg(err, 'find error'))
        }
    }

    static async findByUserId(userId: number): PResultT<ProAttr[]> {
        try {
            const re = await ProjectModel.findAll({
                where: { userId }
            })
            return Ok(re)
        }catch (err) {
            log.error(`find projects of user ${userId} error: `, err)
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
        } catch(err) {
            return Err(errMsg(err, 'query error'))
        }
    }

    static async isExist(uid: IDT, chain: string, name: string): Promise<boolean> {
        log.debug('Info project exist check: ', uid, chain, name)
        try {
            const key = KEY.zProjectNames(uid, chain)
            const names = await projRd.zrange(key, 0, -1)
            log.debug(`project names: `, names, name)
            if (names.includes(name)) {
                log.debug(`duplicate name ${name}`)
                return true
            }
        } catch (e) {
            log.error('Project exist check error: ', e)
            return true
        }
        return false
    }

    static async countByUser(uid: IDT): PResultT<number> {
        const re = await projRd.get(KEY.projectNum(uid))
        if (re === null) { return Ok(0) }
        return Ok(parseInt(re))
    }

    // project number in every chain of user
    static async countOfChainList(uid: IDT): PResultT<Record<string, number>> {
        const key = KEY.zProjectList(uid)
        let re: Record<string, number> = {}
        try {
            let chains = await projRd.keys(key)
            for (let k of chains) {
                let chs = k.split('_')
                let chain_name = chs[chs.length - 2]
                let cnt = await projRd.zcard(k)
                // log.warn('chain: ', c, chain_name, cnt)
                re[chain_name] = cnt
            }
        } catch (e) {
            log.error('Get project count error: ', e)
            return Err(e)
        }
        return Ok(re)
    }
}

export default Project