import Http from 'http'
import { getAppLogger, isErr, PVoidT } from '@elara/lib'
import Dao from '../../dao'
import { ReqDataT, Statistics } from "../../interface"
import Util from '../../util'
import Puber from '../../puber'
import Response from '../../resp'
import { Stat } from '../../statistic'
import { ChainInstance, NodeType } from '../../chain'
import Suber from '..'

const log = getAppLogger('noder')

function post(chain: string, url: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): void {
    const start = Util.traceStart()
    let bw = 0
    const req = Http.request(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8'
        }
    }, (res: Http.IncomingMessage) => {
        res.pipe(resp)
        res.on('data', (chunk) => {
            bw += Util.strBytes(chunk)
        })
        res.on('end', () => {
            stat.bw = bw
            stat.delay = Util.traceDelay(stat.start)
            stat.code = 200
            if (stat.delay > 1000) {
                log.warn(`request ${stat.chain} pid[${stat.pid}] delay ${stat.delay} timeout: %o`, stat.req)
                stat.timeout = true
            }
            // publish statistics
            Stat.publish(stat)
        })
        const time = Util.traceEnd(start)
        log.info(`new node rpc response: chain[${chain}] method ${data.method} time[${time}]`)
    })
    req.on('error', (err: Error) => {
        log.error('post noder rpc request error: %o', err)
        Response.Fail(resp, err.message, 500, stat)
    })
    req.write(JSON.stringify(data))
    req.end()
}

async function getNoder(chain: string, nodeId: number): Promise<Noder> {

    const re = await Dao.getChainInstance(chain, nodeId)
    if (isErr(re)) {
        log.error(`send node rpc request error: ${re.value}`)
        process.exit(2)
    }
    const cconf = re.value as ChainInstance
    return {
        chain,
        nodeId,
        host: cconf.baseUrl,
        port: cconf.rpcPort
    }
}

export interface Noder {
    chain: string,
    nodeId: number,
    host: string,
    port: number
}

export class Noder {

    // method: parameter length
    static memRpcs: Record<string, number> = {
        "state_getKeysPaged": 4,
        "state_getStorage": 2,
        "state_getStorageHash": 2,
        "state_getStorageSize": 2,
        "state_queryStorage": 3,
        "childstate_getKeys": 3,
        "childstate_getStorage": 3,
        "childstate_getStorageHash": 3,
        "childstate_getStorageSize": 3
    }

    static async sendRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): PVoidT {

        const re = await Suber.selectSuber(chain, NodeType.Node)
        if (isErr(re)) {
            log.error(`send rpc request error: ${re.value}`)
            return
        }
        const noder = await getNoder(chain, (re.value as Suber).nodeId)

        log.info(`new node rpc requst, chain ${chain} method ${data.method} params ${data.params}, select noder: ${noder.nodeId}-${noder.host}-${noder.port}`)

        const url = `http://${noder.host}:${noder.port}`
        stat.type = 'node'
        return post(chain, url, data, resp, stat)
    }

    static async sendWs(puber: Puber, data: ReqDataT, stat: Statistics): PVoidT {
        // log.info(`new node ws requst, chain ${puber.chain} method ${data.method} params ${data.params}`)
        Puber.transpond(puber, NodeType.Node, data, stat)
    }

    static async sendMemRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): PVoidT {

        const re = await Suber.selectSuber(chain, NodeType.Mem)
        const noder = await getNoder(chain, (re.value as Suber).nodeId)

        log.info(`new memory node rpc requst, chain ${chain} method ${data.method} params ${data.params}, select noder: ${noder.nodeId}-${noder.host}-${noder.port}`)

        const url = `http://${noder.host}:${noder.port}`
        stat.type = 'mem-node'
        return post(chain, url, data, resp, stat)
    }

    static async sendMemWs(puber: Puber, data: ReqDataT, stat: Statistics): PVoidT {
        Puber.transpond(puber, NodeType.Mem, data, stat)
    }
}

export default Noder