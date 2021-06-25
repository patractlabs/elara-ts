import Http from 'http'
import WebSocket from 'ws'
import { getAppLogger, Ok, isErr, ChainConfig, PResultT, Err } from 'lib'
import Puber from './src/puber'
import Suber from './src/suber'
import Util from './src/util'
import { ChainPidT, WsData } from './src/interface'
import Dao from './src/dao'
import Conf from './config'
import Matcher from './src/matcher'
// import { writeHeapSnapshot } from 'v8'

const log = getAppLogger('Node', true)
const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false})

namespace Response {
    const end = async (res: Http.ServerResponse, data: any, code: number, md5?: string) => {
        res.writeHead(code, {'Content-Type': 'text/plain', 'Trailer': 'Content-MD5'})
        res.addTrailers({'Content-MD5': md5 || '7878'})
        res.write(data)
        res.end()
    }

    export const Ok = async (res: Http.ServerResponse, data: any) => {
        end(res, data, 200)
    }

    export const Fail = async (res: Http.ServerResponse, data: any, code: number) => {
        end(res, data, code)
    }
}

const post = async (cp: ChainPidT, body: any, resp: Http.ServerResponse): PResultT => {
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

const pathOk = async (url: string, host: string): PResultT => {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // TODO request static and limit
    // method check
    log.info(`new rpc request method[${req.method}]`)
    if (!isMethodOk(req.method!)) {
        return Response.Fail(res, 'Invalid method, only POST support', 400)
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
        if (data === '') {
            dstart = Util.traceStart()
        }
        data += chunk
    })
    req.on('end', async () => {
        const dtime = Util.traceEnd(dstart)
        log.info(`handle rpc request body time[${dtime}]`)
        try {
            JSON.parse(data)
        } catch (err) {
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400)
        }
        // transmit request 
        let re = await post(cp, data, res)
        if (isErr(re)) {
            log.error(`transpond rpc request error: ${re.value}`)
            return Response.Fail(res, re.value, 500)
        }
        const request = re.value as Http.ClientRequest
        request.on('error', (err: Error) => {
            log.error('request error: ', err)
            Response.Fail(res, err, 500)
        })
    })
})

// WebSocket request 
Server.on('upgrade', async (res: Http.IncomingMessage, socket, head) => {
    // TODO request static and limit

    const path = res.url!
    const re = await Util.urlParse(path)
    if (isErr(re)) {
        log.error('Invalid socket request: ', re.value)
        return socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`,'ascii')
    }
 
    // only handle urlReg pattern request
    wss.handleUpgrade(res, socket as any, head, (ws, req: any) => {
        // log.info('Handle upgrade event')
        req['chain'] = re.value.chain
        req['pid'] = re.value.pid
        wss.emit('connection', ws, req)
    })
})

// WebSocket connection event handle
wss.on('connection', async (ws, req: any) => {

    log.info(`New socket connection chain ${req.chain} pid[${req.pid}], current total connections `, wss.clients.size)
    // 
    const start = Util.traceStart()
    let re = await Matcher.regist(ws, req.chain, req.pid)
    const time = Util.traceEnd(start)
    log.info(`chain ${req.chain} pid[${req.pid}] puber connect time: ${time}`)
    if (isErr(re)) {
        log.error('Connect handle error: ', re.value)
        let err = re.value
        if (re.value.indexOf('no valid subers of chain') !== 1) {
            ws.send(`no chain named ${req.chain}`)
            err = `Invalid chain`
        }
        return ws.close(1001, err)
    }
    const puber = re.value as Puber

    ws.on('message', async (data) => {
        log.info(`new puber[${puber.id}] request of chain ${puber.chain}: `, data)
        let dat: WsData
        try {
            dat = JSON.parse(data.toString())
        } catch (err) {
            log.error('Parse message to JSON error')  
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }
        Puber.transpond(puber, dat)
    })
 
    ws.on('close', async (code, reason) => {
        log.warn(`Puber[${puber.id}] closed, code[${code}] reason[${reason}], current total connections `, wss.clients.size)
        if (code === 1000) {
            log.error(`server failed, close the current puber[${puber.id}]`)
        }
        Matcher.unRegist(puber.id, code)
    })

    ws.on('error', (err) => {
        log.error(`Puber[${puber.id}] Connection error: `, err)
        // ws.close()
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
    await Suber.init()
    let conf = Conf.getServer()
    Server.listen(conf.port, () => {
        log.info('Elara node transpond server listen on port: ', conf.port)
    })
}

run()