import { ChainConfig, Err, Ok, PResultT } from '@elara/lib'
import Rd from './redis'

class Dao {
    static async getChainList(): PResultT<string[]> {
        return Ok(await Rd.getChainList())
    }

    static async getChainConfig(chain: string): PResultT<ChainConfig> {
        const conf = await Rd.getChainConfig(chain) as ChainConfig
        if (!conf.name) {
            return Err('Invalid chain config')
        }
        return Ok(conf)
    }

    static async updateChainCache(chain: string, method: string, data: any): PResultT<"OK"> {
        return Ok(await Rd.setLatest(chain, method, data))
    }

    static async getChainCache(chain: string, method: string): Promise<Record<string, string>> {
        return Rd.getLatest(chain, method)
    }

    static async getUserStatus(userId: number): Promise<Record<string, string>> {
        return Rd.getUserStatus(userId)
    }

    static async getProjectStatus(chain: string, pid: string): Promise<Record<string, string>> {
        return Rd.getProStatus(chain, pid)
    }

}

export default Dao