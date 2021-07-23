import Http from 'http'
import { ChainConfig, getAppLogger, isErr, PVoidT } from '@elara/lib'
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
                log.warn(`request ${stat.chain} pid[${stat.pid}] delay ${stat.delay} timeout: `, stat.req)
                stat.timeout = true
            }
            // publish statistics
            Stat.publish(stat)
        })
        const time = Util.traceEnd(start)
        log.info(`new node rpc response: chain[${chain}] method ${data.method} time[${time}]`)
    })
    req.on('error', (err: Error) => {
        log.error('post noder rpc request error: ', err)
        Response.Fail(resp, err.message, 500, stat)
    })
    req.write(JSON.stringify(data))
    req.end()
}

class Noder {
    static async sendRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): PVoidT {
        log.info(`new node rpc requst, chain ${chain} method ${data.method} params ${data.params}`)
        const re = await Dao.getChainConfig(chain)
        if (isErr(re)) {
            log.error(`send node rpc request error: ${re.value}`)
            process.exit(2)
        }
        const cconf = re.value as ChainConfig
        const url = `http://${cconf.baseUrl}:${cconf.rpcPort}`
        stat.type = 'node'
        return post(chain, url, data, resp, stat)
    }

    static async sendWs(puber: Puber, data: ReqDataT, stat: Statistics): PVoidT {
        log.info(`new node ws requst, chain ${puber.chain} method ${data.method} params ${data.params}`)
        Puber.transpond(puber, SuberTyp.Node, data, stat)
    }
}

export default Noder