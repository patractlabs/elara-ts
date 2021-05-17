const redis = require('../../../lib/utils/redis')
const Result = require('../../lib/ApiResponse')
const KEY = require('../../lib/KEY')

class Account {
    uid; vip; createtime; ext
    constructor(uid, vip, createtime, ext) {
        this.uid = uid
        this.vip = vip
        this.createtime = createtime
        this.ext = ext
    }
    //账户下的项目总数
    static async projects(uid) {
        let count = await redis.scard(KEY.PROJECT(uid))
        return count ? count : 0
    }

    static async info(uid) {
        let reply = await redis.hgetall(KEY.UID(uid))
        let projects = await Account.projects(uid)
        
        if (reply?.uid) {
            let account = new Account(reply.uid, reply.vip, reply.cratetime, { 'projects': projects })
            return Result.Ok(account)
        }
        return Result.Whocare()
    }
}

export = Account