import { now } from '../lib/tool'
import { getAppLogger, IDT, Err, isErr, Ok, PResultT } from 'lib'
// import { setConfig } from '../../config'

interface Account {
    uid: IDT
    username: IDT
    vip: number
    type: string
    createTime: number | string
}
// const config = setConfig()
const log = getAppLogger('account-pro', true)
const dumpAccount = async (account: Account): PResultT => {
    log.info(account)
    // TODO：异常数据过滤
    try {
        // TODO: 存储操作
    } catch (error) {
        log.error('Dump account error: ', error)
        return Err(error)
    }
    return Ok('ok')
}
namespace Account {
    export const create = async (
        uid: IDT,
        username: IDT,
        vip: number,
        type: string
    ): PResultT => {
        log.info('Into account creat !', uid, username, vip, type)

        const timestamp = now()
        let createTime: number = timestamp
        log.info('timestamp: ', timestamp)

        let account = {
            uid,
            username,
            vip,
            type,
            createTime,
        }
        log.warn('Account to create: ', account)
        let re = await dumpAccount(account)
        if (isErr(re)) {
            return re
        }
        return Ok(account)
    }

    export const info = async (uid: IDT): PResultT => {
        let account = null
        account = {
            uid: uid,
            username: 'test',
        }
        return Ok(account)
    }
}

export = Account
