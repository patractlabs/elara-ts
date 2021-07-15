
import { PResultT,Ok, Err, ChainConfig } from '@elara/lib'
import Rd from './redis'

namespace Dao {
    export const getChainList = async (): PResultT<string[]> => {
        return Ok(await Rd.getChainList() || [])
    }

    export const getChainConfig = async (chain: string): PResultT<ChainConfig> => {
        let conf: any = await Rd.getChainConfig(chain)
        if (!conf.name) {
            return Err('Invalid chain config')
        }
        conf = {
            ...conf,
            extends: JSON.parse(conf.extends),
            excludes: JSON.parse(conf.excludes)
        } as ChainConfig
        return Ok(conf)
    }
}

export const chainPSub = Rd.chainPSub
export default Dao