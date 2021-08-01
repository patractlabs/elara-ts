import { PResultT, Ok, Err, getAppLogger, PBoolT, PVoidT } from '@elara/lib'
import Dao from '../dao'
import Stat from './stat'
import { getModel, UserAttr, UserStat, UserLevel } from '../model/user'
import { Pg } from '../dao/pg'

const log = getAppLogger('user-service', true)

const UserModel = getModel(Pg)

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
        } as UserAttr
        try {
            const re = await UserModel.create(user)
            log.debug('UserModel create result: ', re)
            return Ok(re)
        } catch (err) {
            log.error('create user error: ', err)
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
        }, {
            where: {
                githubId,
            }
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
        log.debug(`user of githubId[${githubId}]: `, user)
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

    static async getLevelByGit(githubId: string): PResultT<UserLevel> {
        const re = await UserModel.findOne({
            where: { githubId },
            attributes: ['level']
        })
        if (re === null) {
            return Err('no this user')
        }
        return Ok(re.level)
    }

    static async checkLimit(chain: string, pid: string): PBoolT {
        log.debug(`check limit status of ${chain} pid[${pid}]`)
        const re = await Stat.proDaily(chain, pid)
        const bw = re.httpBw + re.wsBw
        // project limit
        const pstat = await Dao.getProjectLimit(chain, pid)
        if (pstat.uid === '') {
            return false
        }
        // user limit
        const astat = await Dao.getAccountDetail(pstat.uid as string)
        log.debug('user status: ', astat)
        if (re.httpReqNum > 100 || bw > 10000) {
            return true
        }
        return false
    }
}