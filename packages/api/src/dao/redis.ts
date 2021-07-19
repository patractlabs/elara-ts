import { Redis, DBT, KEYS } from '@elara/lib'
import Account from '../service/account'

const KEY = KEYS.Account

export const statRd = new Redis(DBT.Stat).getClient()

export const projRd = new Redis(DBT.Project).getClient()

export const actRd = new Redis(DBT.Account).getClient()

namespace Rd {
    export async function haddAccount(account: Account): Promise<"OK"> {
        return actRd.hmset(KEY.hAccount(account.uid), account)
    }

    export async function hgetDetail(uid: string): Promise<Record<string, string>> {
        return actRd.hgetall(KEY.hAccount(uid))
    }

    export async function scardProjectNum(uid: string): Promise<number> {
        const key = KEYS.Project.zProjectList(uid)
        return actRd.scard(key)
    }
}

export default Rd