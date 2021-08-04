import { PResultT, Ok, Err, getAppLogger, PBoolT, PVoidT, isErr } from '@elara/lib'
import Stat from './stat'
import UserModel, { UserAttr, UserStat, UserLevel } from '../models/user'
import Project, { ProStatus } from '../models/project'
import ProService from '../service/project'
import Limit from './limit'

const log = getAppLogger('user-service')

export default class User {

    static async create({
        githubId,
        name,
        loginType }: UserAttr
    ): PResultT<UserAttr> {
        const user = {
            githubId,
            name,
            level: UserLevel.Normal,
            status: UserStat.Active,
            loginType
        } as UserModel
        try {
            const re = await UserModel.create(user)
            log.debug('UserModel create result: %o', re)
            return Ok(re)
        } catch (err) {
            log.error('create user error: %o', err)
            return Err(err.errors[0].message ?? 'create error')
        }
    }

    static async destroyByGit(githubId: string, force: boolean = false): PResultT<number> {
        return Ok(await UserModel.destroy({
            where: {
                githubId
            },
            force
        }))
    }

    static async updateLevelByGit(githubId: string, level: UserLevel): PVoidT {
        UserModel.update({
            level
        } as UserModel, {
            where: {
                githubId,
            },
        })
    }

    static async updateStatusByGit(githubId: string, status: UserStat): PVoidT {
        UserModel.update({
            status
        }, {
            where: {
                githubId,
            }
        })
    }

    // if paranoid === false, will find deleted
    static async findUserByGit(githubId: string, paranoid: boolean = true): PResultT<UserAttr> {
        const user = await UserModel.findOne({
            where: { githubId },
            paranoid
        })
        log.debug(`user of githubId[${githubId}]: ${user}`)
        if (user === null) {
            return Err('no this user')
        }
        return Ok(user)
    }

    static async findUserByGitWithProject(githubId: string, paranoid: boolean = true): PResultT<UserAttr> {
        const user = await UserModel.findOne({
            where: { githubId },
            include: Project,
            paranoid        // if false query logic deleted item
        })
        log.debug(`user of githubId[${githubId}] with project: ${user}`)
        if (user === null) {
            return Err('no this user')
        }
        return Ok(user)
    }

    static async getStatusByGit(githubId: string): PResultT<UserStat> {
        const re = await UserModel.findOne({
            where: { githubId },
            attributes: ['status']
        })
        if (re === null) {
            return Err('no this user')
        }
        return Ok(re.status)
    }

    static async getLevelByGit(githubId: string): PResultT<string> {
        const re = await UserModel.findOne({
            where: { githubId },
            attributes: ['level']
        })
        if (re === null) {
            return Err('no this user')
        }
        return Ok(re.level)
    }

    static async getLevelById(id: number): PResultT<string> {
        const re = await UserModel.findOne({
            where: { id },
            attributes: ['level']
        })
        if (re === null) {
            return Err('no this user')
        }
        return Ok(re.level)
    }

    static async projectCreateOutLimit(userId: number, curNum: number): PBoolT {
        const level = await this.getLevelById(userId)
        if (isErr(level)) {
            log.error('query user level error: %o', level.value)
            return true
        }
        const re = await Limit.findByLevel(level.value as UserLevel)
        if (isErr(re)) {
            log.error('query limit resource error: %o', re.value)
            return true
       }
        if (re.value.projectNum > curNum) { return false }
        return true
    }

    static async projectOk(chain: string, pid: string): PResultT<boolean> {
        log.debug(`check limit status of ${chain} pid[${pid}]`)

        // project limit
        const proRe = await ProService.statusByChainPid(chain, pid, true)
        if (isErr(proRe)) {
            log.error('query project limit error: %o',proRe.value)
            return Err('query project error')
        }
        const pro = proRe.value as Project

        if (pro.status !== ProStatus.Active) {
            log.warn(`project [${pid}] is inactive`)
            return Err('inactive project')
        }

        const stat = await Stat.proDaily(chain, pid)
        const bw = stat.httpBw + stat.wsBw
        // invalid request count
        const reqCnt = stat.httpReqNum + stat.wsReqNum + stat.httpInReqNum + stat.wsInReqNum

        log.debug('project current resource usage: %o %o',bw, reqCnt)
        // user limit
        const limitRe = await Limit.findByLevel(pro.user.level)
        if (isErr(limitRe)) {
            log.error('query user resource limit error: %o',limitRe.value)
            return Err('query user resource error')
        }
        const limit = limitRe.value

        const reqDayLimit = pro.reqDayLimit === -1 ? pro.reqDayLimit : limit.reqDayLimit
        const bwDayLimit = pro.bwDayLimit === -1 ? pro.bwDayLimit : limit.bwDayLimit
        if (reqCnt < reqDayLimit && bw < bwDayLimit) {
            return Ok(true)
        }
        return Ok(false)
    }
}