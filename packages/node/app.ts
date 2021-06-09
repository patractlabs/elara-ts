import Http from 'http'
import Stream from 'stream'
import WebSocket from 'ws'
import { getAppLogger, Ok, isNone, isErr, Option, ChainConfig, PResultT, Err } from 'lib'
import Puber from './src/puber'
import Suber from './src/suber'
import Util from './src/util'
import { ChainPidT } from './src/interface'
import Dao from './src/dao'

const log = getAppLogger('Node', true)
const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true })

namespace Response {
    const end = (res: Http.ServerResponse, data: any, code: number, md5?: string) => {
        res.writeHead(code, {'Content-Type': 'text/plain', 'Trailer': 'Content-MD5'})
        res.addTrailers({'Content-MD5': md5 || '7878'})
        res.write(data)
        res.end()
    }

    export const Ok = (res: Http.ServerResponse, data: any) => {
        end(res, data, 200)
    }

    export const Fail = (res: Http.ServerResponse, data: any, code: number) => {
        end(res, data, code)
    }
}

const post = async (cp: ChainPidT, body: any, resp: Http.ServerResponse): PResultT => {
    const chain = cp.chain
    // const pid = cp.pid
    let re = await Dao.getChainConfig(chain)
    if (isErr(re)) {
        log.error('Request error:', re.value)
        Response.Fail(resp, `request error: no valid chain ${chain}`, 500)
        return Err('')
    }
    const conf = re.value as ChainConfig
    let url = `http://${conf.baseUrl}:${conf.rpcPort}`
    log.warn('transmit request url: ', url)
    const req = Http.request(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        log.warn('response: ', res.statusCode)
        let data = ''
        res.on('data', (dat) => {
            data += dat
        })
        res.on('close', () => {
            log.warn('new response: ', data.toString())
            if (!res.statusCode || res.statusCode !== 200) {
                Response.Fail(resp, data, res.statusCode || 500)
            } else {
                Response.Ok(resp, data)
            }
        })
    })
    log.warn('request body: ', body)
    req.write(body)
    req.end()
    return Ok(req)
}

const isMethodOk = (method: string): boolean => {
    log.warn('request method: ', method)
    return method === 'POST'
}

const pathOk = (url: string, host: string): Option<ChainPidT> => {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    log.warn('request path: ', path, url)
    // chain pid valid check
    return Util.urlParse(path)
}

// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // method check
    if (!isMethodOk(req.method!)) {
        Response.Fail(res, 'Invalid method, only POST support', 400)
        return
    }

    // path check
    let re = pathOk(req.url!, req.headers.host!)
    if (isNone(re)) {
        Response.Fail(res, 'Invalid request', 400)
        return
    }
    const cp = re.value as ChainPidT
    let data = ''
    req.on('data', (chunk) => {
        data += chunk
    })
    req.on('end', async () => {
        // no more data
        log.warn('request data: ', data.toString())
        try {
            JSON.parse(data)
        } catch (err) {
            Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400)
            return
        }
        // transmit request 
        let re = await post(cp, data, res)
        if (isErr(re)) {
            Response.Fail(res, re.value, 500)
            return
        }
        const request = re.value as Http.ClientRequest
        request.on('error', (err: Error) => {
            log.error('Request error: ', err)
            Response.Fail(res, 'request error', 500)
        })
    })
})

// WebSocket request 
Server.on('upgrade', async (res: Http.IncomingMessage, socket: Stream.Duplex, head) => {
    const path = res.url!
    log.warn('New socket request: ', path)
    const re: any = Util.urlParse(path)
    if (isNone(re)) {
        log.error('Invalid socket request: ', path)
        socket.end('HTTP/1.1 400 Invalid request \r\n\r\n','ascii')
        return
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

    log.info(`New socket connection CHAIN[${req.chian}] PID[${req.pid}]`, req.chain, req.pid)
    // 
    let re = await Puber.onConnect(ws, req.chain, req.pid)
    if (isErr(re)) {
        log.error('Connect handle error: ', re.value)
        ws.terminate()
        return
    }
    const puber = re.value as Puber
    ws.on('message', (data) => {
        // log.info('New msg-evt: ', data)
        Puber.onMessage(puber, data)
    })
 
    ws.on('close', (code, reason) => {
        log.error('Connection closed: ', code, reason)
        Puber.clear(puber.id)
    })

    ws.on('error', (err) => {
        log.error('Connection error: ', err)
        ws.terminate()
        Puber.clear(puber.id)
    })
    return
})


const run = async () => {
    await Suber.init()
    Server.listen(7001, () => {
        log.info('Elara node server listen on port: 7001')
    })
}

run()

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
            log.error(`process on signal ecent: ${type}: `, err)
        } finally {
            process.kill(process.pid, type)
        }
    })
})