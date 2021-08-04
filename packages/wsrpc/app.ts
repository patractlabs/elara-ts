import Http from 'http'
import Net from 'net'
import WebSocket from 'ws'
import { getAppLogger, Ok, isErr, PResultT, Err, ResultT, PVoidT, unexpectListener, PBoolT } from '@elara/lib'
import Util from './src/util'
import { ChainPidT, ReqDataT, CloseReason, Statistics } from './src/interface'
import Conf, { UnsafeMethods } from './config'
import { dispatchWs, dispatchRpc } from './src/puber'
import Service from './src/service'
import Matcher from './src/matcher'
import Puber from './src/puber'
import Response from './src/resp'
import { Stat } from './src/statistic'

const conf = Conf.getServer()
const log = getAppLogger('app')
const Server = Http.createServer()
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false })

async function pathOk(url: string, host: string): PResultT<ChainPidT> {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

function post(url: string, body: ChainPidT): Promise<any> {
    const start = Util.traceStart()
    return new Promise((resolve, reject) => {
        let data = ''
        const req = Http.request(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=UTF-8'
            }
        }, (res: Http.IncomingMessage) => {
            res.on('data', (chunk) => {
                data += chunk
            })
            res.on('end', () => {
                log.debug('response: ', data)
                resolve(data)
                const time = Util.traceEnd(start)
                log.debug(`new node rpc response time[${time}]`)
            })
        })
        req.on('error', (err: Error) => {
            log.error('post noder rpc request error: %o', err)
            reject({ code: 500, msg: err, data: false })
        })
        req.write(JSON.stringify(body))
        req.end()
    })

}

async function resourceLimit(chain: string, pid: string): PBoolT {
    if (pid === '00000000000000000000000000000000') {
        return false
    }
    // check request limit & bandwidth limit
    const res = await post(`http://${conf.apiHost}:${conf.apiPort}/auth/islimit`, { chain, pid })
    log.debug(`${chain} pid[${pid}] limit check result: %o`, res, chain, pid)
    const ok = JSON.parse(res).data as boolean ?? true
    return ok
}

function isPostMethod(method: string): boolean {
    return method === 'POST'
}

function methodUnsafe(method: string): boolean {
    if (UnsafeMethods.has(method)) return true
    return false
}

function dataCheck(data: string): ResultT<ReqDataT> {
    let dat = JSON.parse(data) as ReqDataT
    if (!dat.id || !dat.jsonrpc || !dat.method || !dat.params) {
        return Err('invalid request must be JSON {"id": string, "jsonrpc": "2.0", "method": "your method", "params": []}')
    }
    if (methodUnsafe(dat.method)) {
        return Err(`Forbiden Access!`)
    }
    return Ok(dat)
}

function initStatistic(proto: string, method: string, header: Http.IncomingHttpHeaders): Statistics {
    let ip = header.host
    if (header['x-forwarded-for']) {
        ip = header['x-forwarded-for'] as string
    }
    const head = { origin: header.origin ?? '', agent: header['user-agent'] ?? '', ip }
    return {
        proto,
        method,
        header: head,
        start: Util.traceStart(),
        reqtime: Date.now()
    } as Statistics
}

// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // method check
    let reqStatis = initStatistic('http', req.method!, req.headers)
    if (!isPostMethod(req.method!)) {
        log.warn(`Invalid method ${req.method}, only POST support: %o`, req.url)
        return Response.Fail(res, 'Invalid method, only POST support', 400, reqStatis)
    }

    // path check
    const re = await pathOk(req.url!, req.headers.host!)
    if (isErr(re)) {
        log.error(`request path check fail: ${re.value}`)
        return Response.Fail(res, re.value, 400, reqStatis)
    }
    const cp = re.value as ChainPidT

    let data = ''
    let dstart = 0
    reqStatis.chain = cp.chain
    reqStatis.pid = cp.pid as string

    req.on('data', (chunk) => {
        if (data == '') {
            dstart = Util.traceStart()
        }
        data += chunk
    })

    req.on('end', async () => {
        const dtime = Util.traceEnd(dstart)
        log.info(`new rpc request: ${data}, parse time[${dtime}]`)
        let dat: ReqDataT
        try {
            let re = dataCheck(data)
            if (isErr(re)) {
                log.error(`rpc request error: ${re.value}`)
                return Response.Fail(res, re.value, 400, reqStatis)
            }
            dat = re.value
            reqStatis.req = dat
            const isLimit = await resourceLimit(cp.chain, cp.pid as string)
            if (isLimit) {
                return Response.Fail(res, 'resource out of limit', 419, reqStatis)
            }
        } catch (err) {
            log.error(`rpc request catch error: %o`, err)
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400, reqStatis)
        }
        // dispatch request 
        dispatchRpc(cp.chain, dat, res, reqStatis)
    })
})

// WebSocket request 
Server.on('upgrade', async (req: Http.IncomingMessage, socket: Net.Socket, head): PVoidT => {
    const path = req.url!
    const re = await Util.urlParse(path)
    let reqStatis = initStatistic('ws', req.method!, req.headers)
    reqStatis.type = 'conn'

    if (isErr(re)) {
        log.error('Invalid socket request: ', re.value)
        // 
        reqStatis.code = 400
        // publish statistics
        Stat.publish(reqStatis)
        await socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
    }
    const { chain, pid } = re.value
    reqStatis.chain = chain
    reqStatis.pid = pid as string

    // only handle urlReg pattern request
    wss.handleUpgrade(req, socket as any, head, (ws, req: any) => {
        req['chain'] = chain
        req['pid'] = pid
        req['stat'] = reqStatis
        wss.emit('connection', ws, req)
    })
})

// WebSocket connection event handle
wss.on('connection', async (ws, req: any) => {
    const { chain, pid } = req
    const stat = req['stat']
    const re = await Matcher.regist(ws, chain, pid)
    if (isErr(re)) {
        log.error(`socket connect error: ${re.value}`)
        if (re.value.includes('suber inactive')) {
            log.error(`suber is unavailable`)
            ws.send(`service unavailable now`)
        }
        stat.code = 500
        // publish statistics
        Stat.publish(stat)
        return ws.terminate()
    }
    const puber = re.value as Puber
    log.info(`New socket connection chain ${chain} pid[${pid}], current total connections `, wss.clients.size)
    const id = puber.id
    stat.code = 200
    // publish statistics
    Stat.publish(stat)

    ws.on('message', async (data) => {
        log.info(`new puber[${id}] request of chain ${chain}: `, data)
        let dat: ReqDataT
        let reqStatis = initStatistic('ws', '', {} as Http.IncomingHttpHeaders)
        reqStatis.code = 400
        reqStatis.chain = chain
        reqStatis.pid = pid
        reqStatis.header = stat.header


        try {
            let re = dataCheck(data.toString())
            if (isErr(re)) {
                log.error(`${re.value}`)
                reqStatis.delay = Util.traceDelay(reqStatis.start)
                Stat.publish(reqStatis)
                return puber.ws.send(re.value)
            }
            dat = re.value
            reqStatis.req = dat
            const isLimit = await resourceLimit(chain, pid)
            if (isLimit) {
                log.error(`${chain} pid[${pid}] resource check failed`)
                reqStatis.code = 419    // rate limit
                reqStatis.delay = Util.traceDelay(reqStatis.start)
                Stat.publish(reqStatis)
                return puber.ws.send('resource out of limit')
            }
        } catch (err) {
            log.error('Parse request to JSON error')
            // publis statistics
            reqStatis.delay = Util.traceDelay(reqStatis.start)
            Stat.publish(reqStatis)
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }
        reqStatis.code = 200
        dispatchWs(req.chain, dat, puber, reqStatis)
    })

    ws.on('close', async (code, reason) => {
        log.error(`puber[${id}] close: ${reason}, code ${code}, reason[${reason}]\n \tcurrent total puber connections `, wss.clients.size)
        if (reason === CloseReason.OutOfLimit || reason === CloseReason.SuberUnavail) {
            return  // out of limit
        }
        Matcher.unRegist(id, reason as CloseReason)
    })

    ws.on('error', (err) => {
        log.error(`Puber[${id}] Connection error: %o`, err)
    })
    return
})

async function run(): PVoidT {
    unexpectListener()

    await Service.init()
    Server.listen(conf.port, () => {
        log.info('Elara server listen on port: ', conf.port)
    })
}

run()