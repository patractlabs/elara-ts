import Http from 'http'
import { ChainConfig, getAppLogger, isErr, PVoidT, randomReplaceId } from '@elara/lib'
import Dao from '../dao'
import { ReqDataT, Statistics } from "../interface"
import Util from '../util'
import Puber from '../puber'
import { SuberTyp } from '../matcher/suber'
import Response from '../resp'
import { Stat } from '../statistic'

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

async function selectNoder(chain: string): Promise<Noder> {
    const ids = await Dao.getChainIds(chain)
    if (ids.length === 0) {
        log.error(`select noder error: node instance id empty`)
        process.exit(1)
    }
    const rnd = randomReplaceId(8)
    const serverId = rnd % ids.length

    const re = await Dao.getChainConfig(chain, serverId)
    if (isErr(re)) {
        log.error(`send node rpc request error: ${re.value}`)
        process.exit(2)
    }
    const cconf = re.value as ChainConfig
    return {
        chain,
        serverId,
        host: cconf.baseUrl,
        port: cconf.rpcPort
    }
}

interface Noder {
    chain: string,
    serverId: number,
    host: string,
    port: number
}

class Noder {

    static async sendRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): PVoidT {

        const noder = await selectNoder(chain)
        log.info(`new node rpc requst, chain ${chain} method ${data.method} params ${data.params}, select noder: ${noder.serverId}-${noder.host}-${noder.port}`)

        const url = `http://${noder.host}:${noder.port}`
        stat.type = 'node'
        return post(chain, url, data, resp, stat)
    }

    static async sendWs(puber: Puber, data: ReqDataT, stat: Statistics): PVoidT {
        log.info(`new node ws requst, chain ${puber.chain} method ${data.method} params ${data.params}`)
        Puber.transpond(puber, SuberTyp.Node, data, stat)
    }
}

export default Noder