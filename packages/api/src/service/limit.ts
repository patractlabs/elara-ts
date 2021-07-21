import Conf from "../../config"
import Account from "./account"
import { formateDate } from "../lib/date"
import KEY from '../lib/KEY'
import { isOk } from '@elara/lib'
import { actRd, statRd } from '../dao/redis'

const limitConf = Conf.getLimit()

class Limit {
    constructor(public daily: number, public project: number) {
        this.daily = daily
        this.project = project
    }

    //账户的每日限额
    static async create(uid: string) {
        let account = await Account.detail(uid)
        // let limit: any = new Limit()
        // limit.daily = config.limit.daily[0]

        let dayl = 0
        let prol = 0
        if (isOk(account)) {
            console.log('Account is vip: ', account.value)
            // dayl = config.limit.daily[account.value.vip]
            // prol = config.limit.project[account.value.vip]
        } else {
            dayl = limitConf.daily.develop
            prol = limitConf.project.develop
        }
        return new Limit(dayl, prol)
    }
    //是否在黑名单
    static async isBlack(uid: string) {
        return await actRd.sismember(KEY.BLACKUID(), uid)
    }
    static async isLimit(uid: string, pid: string) {
        let date = formateDate(new Date())
        let limit = await Limit.create(uid)

        let today_request: any = await statRd.get(KEY.REQUEST(pid, date))
        if (parseInt(today_request) > limit.daily) {
            return true
        }
        return false
    }

}

export default Limit