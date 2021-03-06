import { getAppLogger } from '@elara/lib'
import Dao from '../../dao'

const log = getAppLogger('cacher')

export type CacherStat = {
    block: number,
    acc: number         
}

export class Cacher {

    private static status: Record<string, boolean> = {}

    private static preStat: Record<string, CacherStat> = {}

    static Rpcs: string[] = [
        // sync when block update
        "system_syncState",
        "system_health",
        "chain_getHeader",
        "chain_getBlock",
        "chain_getBlockHash",
        "chain_getFinalizedHead",

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

    static statusOk(chain: string): boolean {
        return Cacher.status[chain]
    }

    static getPrestat(chain: string): CacherStat {
        return Cacher.preStat[chain]
    }

    static updateStatus(chain: string, status: boolean): void {
        Cacher.status[chain] = status
    }

    static updatePrestat(chain: string, stat: CacherStat): void {
        // if (Cacher.preStat[chain] === undefined) {
        //     Cacher.preStat[chain] = {}
        // }
        Cacher.preStat[chain] = stat
    }

    static async send(chain: string, method: string): Promise<Record<string, string>> {
        log.info(`new cache request, chain ${chain} method[${method}]`)
        return Dao.getChainCache(chain, method)
    }
}

export default Cacher