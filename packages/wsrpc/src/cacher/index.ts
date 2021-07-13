import { getAppLogger } from 'lib'
import Dao from '../dao'

const log = getAppLogger('suducer')

class Cacher {

    private static status: boolean = true

    static Rpcs: string[] = [
        // sync when block update
        "system_syncState",
        "system_health",
        "system_peers",
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

    static statusOk(): boolean {
        return Cacher.status
    }

    static updateStatus(status: boolean): void {
        Cacher.status = status
    }

    static async send(chain: string, method: string): Promise<Record<string, string>> {
        log.info(`new cache request, chain ${chain} method[${method}]`)
        return Dao.getChainCache(chain, method)
    }
}

export default Cacher