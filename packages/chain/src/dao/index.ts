import { ChainConfig, Err, Ok, PResultT, PVoidT } from '@elara/lib'
import { Topic } from '../types'
import Rd from './redis'

// TODO return result-type wrap

namespace Dao {
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
}

export default Dao