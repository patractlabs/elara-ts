import { ChainConfig, Err, Ok, PResultT } from 'elara-lib'
import Rd from './redis'

// TODO result
namespace Dao {
    export const getChainList = async (): PResultT<string[]> => {
        return Ok(await Rd.getChainList())
    }

    export const getChainConfig = async (chain: string): PResultT<ChainConfig> => {
        const conf = await Rd.getChainConfig(chain) as ChainConfig
        if (!conf.name) {
            return Err('Invalid chain config')
        }
        return Ok(conf)
    }

    export const updateChainCache = async (chain: string, method: string, data: any): PResultT<"OK"> => {
        return Ok(await Rd.setLatest(chain, method, data))
    }

    export const getChainCache = async (chain: string, method: string): Promise<Record<string, string>> => {
        return Rd.getLatest(chain, method)
    }
}

export default Dao