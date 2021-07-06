import { getAppLogger } from 'lib'
import Dao from '../dao'

const log = getAppLogger('suducer', true)

namespace Cacher {
    export const Rpcs = [

        // sync when block update
        "system_syncState",
        "system_health",
        "chain_getHeader",
        "chain_getBlock",
        "chain_getBlockHash",
        "chain_getFinalizedHead",
    
        // sync once
        "rpc_methods",
        "system_version",
        "system_chain",
        "system_chainType",
        "system_properties",
        "state_getMetadata" 
    ]

    export const send = async (chain: string, method: string) => {
        log.info(`new cache request, chain ${chain} method[${method}]`)
        return Dao.getChainCache(chain, method)
    }
}

export default Cacher