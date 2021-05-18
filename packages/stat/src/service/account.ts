const redis = require('lib/utils/redis')
import { IDT, Result } from 'lib'
import KEY from '../lib/KEY'
import { Some, None, Option } from '../lib/option'

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
    //账户下的项目总数
    static async projects(uid) {
        let count = await redis.scard(KEY.PROJECT(uid))
        return count ? count : 0
    }

    //: Promise<Option<AccountT>>
    static async info(uid) {
        let reply = await redis.hgetall(KEY.UID(uid))
        let projects = await Account.projects(uid)
        
        if (reply?.uid) {
            let account = new Account(reply.uid, reply.vip, reply.cratetime, { 'projects': projects })
            return Some(account)
            // return Result.Ok(account)
        }
        return None
        // return Result.Whocare()
    }
}

// cannot export default , will be undefined function call
export = Account