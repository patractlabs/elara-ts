import { PResultT, Ok, Err, ChainConfig, PVoidT } from '@elara/lib'
import Account from '../service/account'
import Rd from './redis'
import { Topic } from '../service/chain'

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

    // chain
    export const getChainName = async (chain: string): PResultT<string> => {
        const name = await Rd.chainName(chain)
        if (name === null) return Err('')
        return Ok(name)
    }

    export const getChainDetail = async (chain: string): Promise<Record<string, string>> => {
        return Rd.chainDetail(chain)
    }

    export const updateChain = async (chain: ChainConfig): PResultT<string | number> => {
        let re: any = await Rd.setChain(chain)
        // if ok
        const cnt = await Rd.incrChainNum()
        re = Rd.zaddChain(cnt, chain.name.toLowerCase())
        return Ok(re)

    }

    export const delChain = async (chain: string): PVoidT => {
        await Rd.delChain(chain)
        Rd.decrChainNum()
        Rd.zremChain(chain)
    }

    export const getChainList = async (): Promise<string[]> => {
        return Rd.zrangeChain()
    }

    // pub sub
    export const publishTopic = async (topic: Topic, data: string): Promise<number> => {
        return Rd.publishTopic(topic, data)
    }

    // project

    export const getProjectLimit = async (chain: string, pid: string): Promise<Record<string, number|string>> => {
        const re = await Rd.hgetProject(chain, pid)
        return {
            uid: re[2] ?? '',
            bwDayLimit: parseInt(re[0] ?? '0'),
            reqDayLimit: parseInt(re[1] ?? '0')
        }
    }
}

export default Dao