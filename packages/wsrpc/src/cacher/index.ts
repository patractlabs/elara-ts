import { getAppLogger } from 'lib'
import Dao from '../dao'

const log = getAppLogger('suducer', true)

namespace Cacher {
    export const Rpcs = [

        // sync when block update
        "system_syncState",
        "system_health",
        // "system_peers",
        "chain_getHeader",
        "chain_getBlock",
        "chain_getBlockHash",
        "chain_getFinalizedHead",
        "author_pendingExtrinsics",

        // sync once
        "rpc_methods",
        "system_name",
        "system_version",
        "system_chain",
        "system_chainType",
        "system_properties",
        "state_getMetadata",
        "state_getRuntimeVersion"
    ]

    export const send = async (chain: string, method: string): Promise<Record<string, string>> => {
        log.info(`new cache request, chain ${chain} method[${method}]`)
        return Dao.getChainCache(chain, method)
    }
}

export default Cacher