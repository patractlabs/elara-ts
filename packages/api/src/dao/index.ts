import { PResultT, Ok, Err } from '@elara/lib'
import Account from '../service/account'
import Rd from './redis'

namespace Dao {
    export const createAccount = async (account: Account): PResultT<void> => {
        const re = await Rd.haddAccount(account)
        if (re !== "OK") return Err('create account failed')
        return Ok(void(0))
    }

    export const getAccountDetail = async (uid: string): PResultT<Record<string, string>> => {
        const re = await Rd.hgetDetail(uid)
        if (!re.uid) { return Err(`invalid uid ${uid}`) }
        return Ok(re)
    }

    export const getProjectNum = async (uid: string): PResultT<number> => {
        return Ok(await Rd.scardProjectNum(uid))
    }
}

export default Dao