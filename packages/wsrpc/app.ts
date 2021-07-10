import Http from 'http'
import WebSocket from 'ws'
import { getAppLogger, Ok, isErr, ChainConfig, PResultT, Err, ResultT } from 'lib'
import Util from './src/util'
import { ChainPidT, ReqDataT, WsData } from './src/interface'
import Dao from './src/dao'
import Conf, { UnsafeMethods } from './config'
import { dispatchWs, dispatchRpc } from './src/puber'
import Service from './src/service'
import Matcher from './src/matcher'
import Puber from './src/puber'
import { Response } from './src/util'

const log = getAppLogger('app', true)
const Server = Http.createServer()
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false })

export async function post(cp: ChainPidT, body: any, resp: Http.ServerResponse): PResultT<Http.ClientRequest> {
    const chain = cp.chain
    // const pid = cp.pid
    let re = await Dao.getChainConfig(chain)
    if (isErr(re)) {
        log.error('Request error:', re.value)
        return Err('invalid chain')
    }
    const conf = re.value as ChainConfig
    let url = `http://${conf.baseUrl}:${conf.rpcPort}`
    const start = Util.traceStart()
    const req = Http.request(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        res.pipe(resp)
        const time = Util.traceEnd(start)
        log.info(`new rpc response: chain[${chain}] pid[${cp.pid}] body[${body}] time[${time}]`)
    })
    req.write(body)
    req.end()
    log.info(`Transpond rpc request: `, body)
    return Ok(req)
}

const isMethodOk = (method: string): boolean => {
    return method === 'POST'
}

const pathOk = async (url: string, host: string): PResultT<ChainPidT> => {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

const methodUnsafe = (method: string): boolean => {
    if (UnsafeMethods.has(method)) return true
    return false
}

const dataCheck = (data: string): ResultT<WsData> => {
    log.debug(`data before check: ${data}`)
    let dat = JSON.parse(data) as WsData
    if (!dat.id || !dat.jsonrpc || !dat.method || !dat.params) {
        return Err('invalid request must be JSON {"id": string, "jsonrpc": "2.0", "method": "your method", "params": []}')
    }
    if (methodUnsafe(dat.method)) {
        return Err(`Forbiden Access!`)
    }
    log.debug(`data afrer check: ${JSON.stringify(dat)}`)
    return Ok(dat)
}
// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // TODO request static and limit
    // method check
    log.info(`new rpc request method[${req.method}]`)
    if (!isMethodOk(req.method!)) {
        return Response.Fail(res, 'Invalid method, only POST support', 400)
    }

    if (methodUnsafe(req.method!)) {
        return Response.Fail(res, `Forbiden Access!`, 400)
    }

    // path check
    let re = await pathOk(req.url!, req.headers.host!)
    if (isErr(re)) {
        log.error(`request path check fail: ${re.value}`)
        return Response.Fail(res, re.value, 400)
    }
    const cp = re.value as ChainPidT
    let data = ''
    let dstart = 0
    req.on('data', (chunk) => {
        if (data == '') {
            dstart = Util.traceStart()
        }
        data += chunk
    })
    req.on('end', async () => {
        const dtime = Util.traceEnd(dstart)
        log.info(`handle rpc request body time[${dtime}]`)
        let dat: ReqDataT
        try {
            let re = dataCheck(data)
            if (isErr(re)) {
                return Response.Fail(res, re.value, 400)
            }
            dat = re.value
        } catch (err) {
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400)
        }
        // dispatch request 
        dispatchRpc(cp.chain, dat, res)
    })
})

// WebSocket request 
Server.on('upgrade', async (res: Http.IncomingMessage, socket, head) => {
    const path = res.url!
    const re = await Util.urlParse(path)
    if (isErr(re)) {
        log.error('Invalid socket request: ', re.value)
        return socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
    }

    // only handle urlReg pattern request
    wss.handleUpgrade(res, socket as any, head, (ws, req: any) => {
        req['chain'] = re.value.chain
        req['pid'] = re.value.pid
        wss.emit('connection', ws, req)
    })
})

// WebSocket connection event handle
wss.on('connection', async (ws, req: any) => {

    const re = await Matcher.regist(ws, req.chain, req.pid)
    if (isErr(re)) {
        log.error(`socket connect error: ${re.value}`)
        if (re.value.includes('suber inactive')) {
            log.error(`suber is unavailable`)
            ws.send(`service unavailable now`)
        }
        return ws.terminate()
    }
    const puber = re.value as Puber
    log.info(`New socket connection chain ${req.chain} pid[${req.pid}], current total connections `, wss.clients.size)
    const id = puber.id

    ws.on('message', async (data) => {
        log.info(`new puber[${id}] request of chain ${req.chain}: `, data)
        let dat: ReqDataT
        try {
            let re = dataCheck(data.toString())
            if (isErr(re)) {
                log.error(`${re.value}`)
                return puber.ws.send(re.value)
            }
            log.debug(`after data check: ${JSON.stringify(re.value)}`)
            dat = re.value
            log.debug(`data: ${JSON.stringify(dat)}`)
        } catch (err) {
            log.error('Parse message to JSON error')
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }

        dispatchWs(req.chain, dat, puber)
    })

    ws.on('close', async (code, reason) => {
        log.error(`puber[${id}] close: ${reason}, code ${code}, reason[${reason}]\n \tcurrent total puber connections `, wss.clients.size)
        if (reason === Puber.CloseReason.OutOfLimit || reason === Puber.CloseReason.SuberUnavail) {
            return  // out of limit
        }
        Matcher.unRegist(id, reason as Puber.CloseReason)
    })

    ws.on('error', (err) => {
        log.error(`Puber[${id}] Connection error: `, err)
    })
    return
})

const errorTypes = ['unhandledRejection', 'uncaughtException']
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

errorTypes.map(type => {
    process.on(type, async (err) => {
        try {
            log.error(`process on ${type}: `, err)
            process.exit(1)
        } catch (_) {
            log.error(`process catch ${type}: `, err)
            process.exit(2)
        }
    })
})

signalTraps.map((type: any) => {
    process.once(type, async (err) => {
        try {
            log.error(`process on signal event: ${type}: `, err)
        } finally {
            process.kill(process.pid, type)
        }
    })
})

const run = async () => {
    let conf = Conf.getServer()
    await Service.init()
    Server.listen(conf.port, () => {
        log.info('Elara server listen on port: ', conf.port)
    })
}

run()