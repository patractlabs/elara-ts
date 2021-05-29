import { ChainConfig, Err, Ok, PResultT } from 'lib'
import { Topic } from '../types'
import Rd from './redis'

// TODO return result-type wrap

namespace Dao {
    export const getChainName = async (chain: string): PResultT => {
        const name = await Rd.chainName(chain)
        if (name === null) return Err('')
        return Ok(name)
    }

    export const getChainDetail = async (chain: string) => {
        return Rd.chainDetail(chain)
    }

    export const updateChain = async (chain: ChainConfig) => {
        let re: any = await Rd.setChain(chain)
        // if ok
        const cnt = await Rd.incrChainNum()
        re = Rd.zaddChain(cnt, chain.name.toLowerCase())
        return Ok(re)
        
    }

    export const delChain = async (chain: string) => {
        await Rd.delChain(chain)
        Rd.decrChainNum()
        Rd.zremChain(chain)
    }

    export const getChainList = async () => {
        return Rd.zrangeChain()
    }

    // pub sub
    export const publishTopic = async (topic: Topic, data: string) => {
        return Rd.publishTopic(topic, data)
    }
}

export default Dao