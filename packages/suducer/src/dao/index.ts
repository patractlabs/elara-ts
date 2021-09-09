import { Err, Ok, PResultT } from '@elara/lib'
import Rd from './redis'

// TODO result
class Dao {
    static async getChainList(): PResultT<string[]> {
        return Ok(await Rd.getChainList())
    }

    static async getChainIds(chain: string) {
        return Rd.getChainIds(chain)
    }

    static async getChainConfig(chain: string, serverId: number): PResultT<Record<string, string>> {
        const conf = await Rd.getChainConfig(chain, serverId)
        if (!conf.name) {
            return Err('Invalid chain config')
        }
        return Ok(conf)
    }

    static async updateChainCache(chain: string, method: string, data: any): PResultT<"OK"> {
        chain = chain.split('-')[0]
        return Ok(await Rd.setLatest(chain, method, data))
    }
}

export default Dao