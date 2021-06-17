import Http from 'http'
import WebSocket from 'ws'
import { getAppLogger, Ok, isNone, isErr, Option, ChainConfig, PResultT, Err } from 'lib'
import Puber from './src/puber'
import Suber from './src/suber'
import Util from './src/util'
import { ChainPidT } from './src/interface'
import Dao from './src/dao'
import Conf from './config'
// import { writeHeapSnapshot } from 'v8'

const log = getAppLogger('Node', true)
const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false, backlog: 10})

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
    const req = Http.request(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        res.pipe(resp)
        // let data = ''
        // res.on('data', (dat) => {
        //     data += dat
        // })
        // res.on('close', () => {
        //     // log.warn('new response: ', data.toString())
        //     if (!res.statusCode || res.statusCode !== 200) {
        //         Response.Fail(resp, data, res.statusCode || 500)
        //     } else {
        //         Response.Ok(resp, data)
        //     }
        // })
    })
    req.write(body)
    req.end()
    return Ok(req)
}

const isMethodOk = (method: string): boolean => {
    return method === 'POST'
}

const pathOk = (url: string, host: string): Option<ChainPidT> => {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // method check
    if (!isMethodOk(req.method!)) {
        // log.warn('method: ', req.method)
        return Response.Fail(res, 'Invalid method, only POST support', 400)
    }

    // path check
    let re = pathOk(req.url!, req.headers.host!)
    if (isNone(re)) {
        return Response.Fail(res, 'Invalid request', 400)
    }
    const cp = re.value as ChainPidT
    let data = ''
    req.on('data', (chunk) => {
        data += chunk
    })
    req.on('end', async () => {
        try {
            JSON.parse(data)
        } catch (err) {
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400)
        }
        // transmit request 
        let re = await post(cp, data, res)
        if (isErr(re)) {
            return Response.Fail(res, re.value, 500)
        }
        const request = re.value as Http.ClientRequest
        request.on('error', (err: Error) => {
            log.error('Request error: ', err)
            Response.Fail(res, 'request error', 500)
        })
    })
})

// WebSocket request 
Server.on('upgrade', async (res: Http.IncomingMessage, socket, head) => {
    const path = res.url!
    log.warn('New socket request: ', path)
    const re: any = Util.urlParse(path)
    if (isNone(re)) {
        log.error('Invalid socket request: ', path)
        return socket.end('HTTP/1.1 400 Invalid request \r\n\r\n','ascii')
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

    log.info(`New socket connection CHAIN[${req.chian}] PID[${req.pid}]: `, req.chain, req.pid, wss.clients.size)
    // 
    let re = await Puber.onConnect(ws, req.chain, req.pid)
    if (isErr(re)) {
        log.error('Connect handle error: ', re.value)
        if (re.value.indexOf('no valid subers of chain') !== 1) {
            ws.send(`no chain named ${req.chain}`)
            ws.close(1001, 'Invalid chain')
            return
        }
        ws.terminate()
        return
    }
    const puber = re.value as Puber

    ws.on('message', (data) => {
        // log.info('New msg-evt: ', data)
        Puber.onMessage(puber, data)
    })
 
    ws.on('close', (code, reason) => {
        log.error('Client close connection to puber: ', code, reason, wss.clients.size)
        Puber.clear(puber.id)
    })

    ws.on('error', (err) => {
        log.error('Connection error: ', err)
        ws.terminate()
        Puber.clear(puber.id)
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
    // setInterval(() => {
    //     Util.logMemory()
        
    // }, 5000)

    // setInterval(() => {
    //     writeHeapSnapshot('./'+Date.now() + '.heapsnapshot')
    // }, 60000)
}

run()