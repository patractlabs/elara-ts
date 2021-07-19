import { PResultT, Ok, IDT, getAppLogger } from '@elara/lib'
import { now } from '../lib/date'
import Dao from '../dao'
import Project from './project'

const log = getAppLogger('account-pro', true)

interface Account {
    uid: IDT
    username: IDT
    vip: number
    type: string
    createTime: number | string
    apikey: string
    [key: string]: any
}

class Account {

    static async create(
        uid: IDT,
        username: IDT,
        vip: number,
        type: string,
        apikey: string
    ): PResultT<Account> {
        log.info('Into account creat !', uid, username, vip, type, apikey)
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
        Dao.createAccount(account)
        return Ok(account)
    }

    static async detail(uid: string): PResultT<Account> {
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

    static async info(uid: string) {
        let reply = await Dao.getAccountDetail(uid)
        let projects = await Project.projectNumOfAllChain(uid)
        reply
        projects
    }

}

async function projects(uid: IDT): PResultT<number> {
    return await Dao.getProjectNum(uid.toString())
}

export default Account
