import { Err, Ok, PResultT, Option, None, Some, PVoidT } from '@elara/lib'
import { ChainInstance } from '../chain'
import { WsData } from '../interface'
import Rd from './redis'

class Dao {
    static async getChainList(): PResultT<string[]> {
        return Ok(await Rd.getChainList())
    }

    static async getChainIds(chain: string): Promise<string[]> {
        return Rd.getChainIds(chain)
    }

    static async getChainInstance(chain: string, nodeId: number): PResultT<ChainInstance> {
        const conf = await Rd.getChainInstance(chain, nodeId) as ChainInstance
        if (!conf.name) {
            return Err('Invalid chain instance')
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

    static async clearProjectStatistic(chain: string, pid: string): PVoidT {
        return Rd.clearProjectStatistic(chain, pid)
    }

    // subscribe response cache
    static async cacheSubscribeResponse(subsId: string, res: WsData): PVoidT {
        Rd.cacheSubscribeResponse(subsId, res)
    }

    static async fetchSubscribeResponse(subsId: string): Promise<Option<string>> {
        const res = await Rd.fetchSubscribeResponse(subsId)
        if (res === null) { return None }
        return Some(res)
    }

    static async clearSubscribeResponse(subsId: string): PVoidT {
        Rd.clearSubscribeResponse(subsId)
    }
}

export default Dao