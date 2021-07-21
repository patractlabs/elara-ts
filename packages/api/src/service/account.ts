import { PResultT, Ok, Err, IDT, getAppLogger } from '@elara/lib'
import { now } from '../lib/date'
import Dao from '../dao'
import Project from './project'

const log = getAppLogger('account-pro', true)

enum AccountStat {
    Active = 'active',
    Suspend = 'suspend',    // update 00:00 o'clock
    Barred = 'barred'       // account abandon
}

enum AccountLevel {
    Normal = 0,
    Bronze,
    Silver,
    Gold
}

interface Account {
    uid: string,
    username: IDT,
    level: AccountLevel,
    type: string,
    status: AccountStat,
    createTime: number | string
}

class Account {

    static async create(
        uid: IDT,
        username: IDT,
        level: number,
        type: string,
    ): PResultT<Account> {
        log.debug('Into account create:', uid, username, level, type)
        const timestamp = now()
        let createTime: number = timestamp
        const account: Account = {
            uid,
            username,
            level: AccountLevel.Normal,
            status: AccountStat.Active,
            createTime,
        } as Account
        log.debug('Account to create: ', account)
        Dao.createAccount(account)
        return Ok(account)
    }

    static async detail(uid: string): PResultT<Account> {
        const re: any = await Dao.getAccountDetail(uid.toString())
        let account = null
        if (re && re.uid) {
            account = {
                ...re,
                uid: re.uid,
                vip: re.vip,
                username: re.username,
                apikey: re.apikey,
            }
        } else {
            return Err('')
        }
        return Ok(account)
    }

    static async info(uid: string) {
        let reply = await Dao.getAccountDetail(uid)
        let projects = await Project.countByUser(uid)
        reply
        projects
    }
}

export default Account
