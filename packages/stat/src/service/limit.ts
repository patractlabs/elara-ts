import { setConfig } from "../../config"

const Account = require('./account')
const { formateDate } = require('../lib/date');
const KEY = require('../lib/KEY')
import { isSome } from 'lib'
import { actRd, statRd } from '../db/redis'
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
        if (isSome(account)) {
            console.log('Account is vip: ', account.value)
            // dayl = config.limit.daily[account.value.vip]
            // prol = config.limit.project[account.value.vip]
        } else {
            dayl = config.limit.daily[0]
            prol = config.limit.project[0]
        }
        return new Limit(dayl, prol)
    }
    //是否在黑名单
    static async isBlack(uid) {
        return await actRd.sismember(KEY.BLACKUID(), uid)
    }
    static async isLimit(uid, pid) {
        let date = formateDate(new Date())
        let limit = await Limit.create(uid)

        let today_request: any = await statRd.get(KEY.REQUEST(pid, date))
        if (parseInt(today_request) > limit.daily) {
            return true
        }
        return false
    }

}

export = Limit