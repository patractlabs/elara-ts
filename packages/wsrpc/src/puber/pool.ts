import WebSocket from "ws";
import Http from 'http'
import { getAppLogger, isErr } from "@elara/lib";
import Chain from "../chain";
import { Statistics, ReqDataT, CloseReason } from "../interface";
import Matcher from "../matcher";
import Util from "../util";
import { Stat } from "../statistic";
import Dao from "../dao";
import Puber, { dispatchWs } from ".";

const log = getAppLogger('puber-pool')

interface IncomingRequest extends Http.IncomingMessage {
    chain: string,
    pid: string,
    trace: number,
    stat: Statistics
}

function createPuberServer(chain: string): WebSocket.Server {
    const wss = new WebSocket.Server({
        noServer: true,
        perMessageDeflate: true
    })

    wss.on('error', async (err: Error) => {
        log.error(`create ${chain} puber server error: %o`, err)
        PuberPool.del(chain)
        await Util.sleep(1)
        createPuberServer(chain)
    })

    wss.on('connection', async (ws: WebSocket, req: Http.IncomingMessage) => {
        const { chain, pid, trace, stat } = req as IncomingRequest
        const re = await Matcher.regist(ws, chain, pid)
        if (isErr(re)) {
            log.error(`${chain} pid[${pid}] socket connect error: ${re.value}`)
            if (re.value.includes('suber inactive')) {
                const delay = Util.traceEnd(trace)
                log.error(`${chain} pid[${pid}] suber is unavailable, connection delay ${delay}`)
                ws.send(`service unavailable now`)
            }
            stat.code = 500
            // publish statistics
            Stat.publish(stat)
            ws.terminate()
            return
        }
        const puber = re.value as Puber
        let ip = req.socket.remoteAddress
        const forward = req.headers['x-forwarded-for']
        if (forward) {
            ip = (forward as string).split(',')[0].trim()
        }
        const id = puber.id
        stat.code = 200
        // publish statistics
        Stat.publish(stat)
        const delay = Util.traceEnd(trace)
        log.info(`New socket connection chain ${chain} pid[${pid}] ip[${ip}] delay[${delay}], current total connections: %o`, wss.clients.size)

        ws.on('message', async (data) => {
            let dat: ReqDataT
            let reqStatis = Stat.build('ws', '', {} as Http.IncomingHttpHeaders)
            reqStatis.code = 400
            reqStatis.chain = chain
            reqStatis.pid = pid
            reqStatis.header = stat.header

            try {
                let re = Util.rpcCheck(data.toString())
                if (isErr(re)) {
                    reqStatis.delay = Util.traceDelay(reqStatis.start)
                    Stat.publish(reqStatis)
                    log.error(`${chain} pid[${pid}] puber[${id}] new request error: ${re.value}, handle msg delay: ${reqStatis.delay}`)
                    return puber.ws.send(re.value)
                }
                dat = re.value
                reqStatis.req = dat
                const isLimit = await Matcher.resourceLimitOk(chain, pid)
                if (isErr(isLimit)) {
                    reqStatis.code = 419    // rate limit
                    reqStatis.delay = Util.traceDelay(reqStatis.start)
                    Stat.publish(reqStatis)
                    log.error(`${chain} pid[${pid}] resource check failed: %o, handle msg delay: ${reqStatis.delay}`, isLimit.value)
                    return puber.ws.send('resource out of limit')
                }
            } catch (err) {
                // publis statistics
                reqStatis.delay = Util.traceDelay(reqStatis.start)
                reqStatis.code = 500
                Stat.publish(reqStatis)
                log.error(`${chain} pid[${pid}] puber[${id}] parse request to JSON error: %o, handle msg delay: ${reqStatis.delay}`, data)
                return puber.ws.send('Invalid jsonrpc request')
            }
            reqStatis.code = 200
            dispatchWs(chain, dat, puber, reqStatis)
        })

        ws.on('close', async (code, reason) => {
            /// puber close
            /// 1. client closed: clear all request cache, unsubscribe all topics
            /// 2. node failed: clear non-subscribe request cache, since node won't response anymore,
            ///     clear subscribe topics on kv, try to unsubscribe.
            /// 3. kv failed: close the socket connection, clear kv subscribe cache, unsubscribe node subscribe topic.
            log.error(`${chain}-${puber.nodeId} pid[${pid}] puber[${id}] close: code ${code}, reason ${reason}, current total puber connections: %o`, wss.clients.size)
            if (reason === CloseReason.OutOfLimit) {
                return  // out of limit
            }
            Matcher.unRegist(id, reason as CloseReason)
            // clear project statistic, which has been delete
            const projectIsOk = await Matcher.projectOk(chain, pid)
            if (!projectIsOk) {
                // clear project statistic
                log.warn(`${chain} project[${pid}] is deleted, clear statistic now`)
                Dao.clearProjectStatistic(chain, pid)
            }
        })

        ws.on('error', (err) => {
            ws.terminate()
            log.error(`${chain}-${puber.nodeId} pid[${pid}] Puber[${id}] Connection error: %o`, err)
        })
        return
    })

    return wss
}


export default class PuberPool {
    private static pool: Record<string, WebSocket.Server> = {}

    static add(chain: string, wss: WebSocket.Server) {
        this.pool[chain] = wss
    }

    static del(chain: string) {
        this.pool[chain].removeAllListeners()
        delete this.pool[chain]
    }

    static get(chain: string): WebSocket.Server {
        return this.pool[chain]
    }

    static async init() {
        const chains = Chain.getChains()
        for (let chain of chains) {
            const ser = createPuberServer(chain)
            this.add(chain, ser)
        }
    }
}
