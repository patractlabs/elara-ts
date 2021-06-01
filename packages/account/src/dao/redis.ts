import { KEYS, Account, Redis } from 'lib'

const KEY = KEYS.Account
const accountClient = Redis.newClient(Redis.DBT.Account)
const accountRd = accountClient.client

Redis.onConnect(accountClient)
Redis.onError(accountClient)

namespace Rd {
    export const haddAccount = async (account: Account) => {
        return accountRd.hmset(KEY.hAccount(account.uid), account)
    }

    export const hgetDetail = async (uid: string) => {
        return accountRd.hgetall(KEY.hAccount(uid))
    }

    export const scardProjectNum = async (uid: string) => {
        const key = KEYS.Project.zProjectList(uid)
        return accountRd.scard(key)
    }
}

export default Rd
