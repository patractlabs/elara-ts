import { Err, Ok, PResultT } from 'lib'
import Rd from './redis'

// TODO result
namespace Dao {
    export const getChainList = async () => {
        return Rd.getChainList()
    }

    export const getChainConfig = async (chain: string): PResultT => {
        const conf = await Rd.getChainConfig(chain)
        if (!conf.name) {
            return Err('Invalid chain config')
        }
        return Ok(conf)
    }

    export const updateChainCache = async (chain: string, method: string, data: any) => {
        return Rd.setLatest(chain, method, data)
    }
}

export const chainPSub = Rd.chainPSub

export default Dao