import { setConfig } from "../../config/config"

const Account = require('./account')
const { formateDate } = require('../../lib/date');
const redis = require('../../../lib/utils/redis')
const KEY = require('../../lib/KEY')
const config = setConfig()
class Limit {
    constructor(public daily: number, public project: number) {
        this.daily = daily
        this.project = project
    }

    //账户的每日限额
    static async create(uid) {
        let account = await Account.info(uid)
        // let limit: any = new Limit()
        // limit.daily = config.limit.daily[0]
        // limit.project = config.limit.project[0]

        let dayl = 0
        let prol = 0
        if (account.isOk()) {
            console.log('Account is vip: ', account.data)
            dayl = config.limit.daily[account.data.vip]
            prol = config.limit.project[account.data.vip]
        } else {
            console.log('Get the config limit')
            dayl = config.limit.daily[0]
            prol = config.limit.project[0]
        }
        console.log('config init: ', config, dayl, prol)

        return new Limit(dayl, prol)
    }
    //是否在黑名单
    static async isBlack(uid) {
        return await redis.sismember(KEY.BLACKUID(), uid)
    }
    static async isLimit(uid, pid) {
        let date = formateDate(new Date())
        let limit = await Limit.create(uid)

        let today_request = await redis.get(KEY.REQUEST(pid, date))
        if (today_request > limit.daily) {
            return true
        }
        return false
    }

}

export = Limit