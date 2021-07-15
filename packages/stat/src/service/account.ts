import { IDT, isErr } from 'elara-lib'
import KEY from '../lib/KEY'
import { Some, None, Option } from 'elara-lib'
import Project from './project'
import { actRd } from '../db/redis'

type POption<T> = Promise<Option<T>>

interface AccountT {
    uid: IDT
    vip: any
    createTime: string
    ext: any
}

class Account {
    uid; vip; createTime; ext
    constructor(uid, vip, createtime, ext) {
        this.uid = uid
        this.vip = vip
        this.createTime = createtime
        this.ext = ext
    }

    //: Promise<Option<AccountT>>
    static async info(uid) {
        let reply = await actRd.hgetall(KEY.UID(uid))
        let projects = await Project.projectNumOfAllChain(uid)
        if (isErr(projects)) {
            // log.error('Get project num error: ', projects.value)
            return None
        }
        if (reply?.uid) {
            let account = new Account(reply.uid, reply.vip, reply.cratetime, { 'projects': projects.value })
            return Some(account)
            // return Result.Ok(account)
        }
        return None
        // return Result.Whocare()
    }
}

// cannot export default , will be undefined function call
export = Account