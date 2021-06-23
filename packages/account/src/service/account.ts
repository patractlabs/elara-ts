import { PResultT, Ok, Account, IDT, getAppLogger } from 'lib'
import { now } from '../lib/tool'
import Dao from '../dao'
import { actRd } from '../db/redis'

actRd.on('connect', () => {
    log.info('Redis connect successfuly')
})

actRd.on('error', (e) => {
    log.error('Redis error: ', e)
})

const log = getAppLogger('account-pro', true)

namespace Account {
    export const create = async (
        uid: IDT,
        username: IDT,
        vip: number,
        type: string,
        apikey:string
    ): PResultT => {
        log.info('Into account creat !', uid, username, vip, type,apikey)
        const timestamp = now()
        let createTime: number = timestamp
        const account: Account = {
            uid,
            username,
            vip,
            type,
            createTime,
            apikey,
        }
        log.warn('Account to create: ', account)
        let re = await Dao.createAccount(account)
        return Ok(re)
    }

    export const detail = async (uid: IDT): PResultT => {
        const re: any = await Dao.getAccountDetail(uid.toString())
        let projectNum = (await projects(uid)).valueOf
        let account = null
        if (re && re.uid) {
            account = {
                ...re,
                uid: re.uid,
                vip: re.vip,
                username: re.username,
                apikey: re.apikey,
                projectNum: projectNum,
            }
        }
        return Ok(account)
    }

    async function projects(uid: IDT) {
        return await Dao.getProjectNum(uid.toString())
    }
}

export = Account
