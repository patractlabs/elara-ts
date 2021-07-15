import Http from 'http'
import Net from 'net'
import WebSocket from 'ws'
import { getAppLogger, Ok, isErr, PResultT, Err, ResultT, PVoidT, unexpectListener } from '@elara/lib'
import Util from './src/util'
import { ChainPidT, ReqDataT, WsData, CloseReason } from './src/interface'
import Conf, { UnsafeMethods } from './config'
import { dispatchWs, dispatchRpc } from './src/puber'
import Service from './src/service'
import Matcher from './src/matcher'
import Puber from './src/puber'
import { Response } from './src/util'

const log = getAppLogger('app')
const Server = Http.createServer()
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false })

async function pathOk(url: string, host: string): PResultT<ChainPidT> {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

function isPostMethod(method: string): boolean {
    return method === 'POST'
}

function methodUnsafe(method: string): boolean {
    if (UnsafeMethods.has(method)) return true
    return false
}

function dataCheck(data: string): ResultT<WsData> {
    let dat = JSON.parse(data) as WsData
    if (!dat.id || !dat.jsonrpc || !dat.method || !dat.params) {
        return Err('invalid request must be JSON {"id": string, "jsonrpc": "2.0", "method": "your method", "params": []}')
    }
    if (methodUnsafe(dat.method)) {
        return Err(`Forbiden Access!`)
    }
    return Ok(dat)
}
// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // method check
    if (!isPostMethod(req.method!)) {
        log.warn(`Invalid method ${req.method}, only POST support: `, req.url)
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
                return Response.Fail(res, re.value, 400)
            }
            dat = re.value
        } catch (err) {
            log.error(`rpc request catch error: `, err)
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400)
        }
        // dispatch request 
        dispatchRpc(cp.chain, dat, res)
    })
})

// WebSocket request 
Server.on('upgrade', async (res: Http.IncomingMessage, socket: Net.Socket, head): PVoidT => {
    const path = res.url!
    const re = await Util.urlParse(path)
    if (isErr(re)) {
        log.error('Invalid socket request: ', re.value)
        await socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
        // return 
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
            dat = re.value
        } catch (err) {
            log.error('Parse message to JSON error')
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }
        dispatchWs(req.chain, dat, puber)
    })

    ws.on('close', async (code, reason) => {
        log.error(`puber[${id}] close: ${reason}, code ${code}, reason[${reason}]\n \tcurrent total puber connections `, wss.clients.size)
        if (reason === CloseReason.OutOfLimit || reason === CloseReason.SuberUnavail) {
            return  // out of limit
        }
        Matcher.unRegist(id, reason as CloseReason)
    })

    ws.on('error', (err) => {
        log.error(`Puber[${id}] Connection error: `, err)
    })
    return
})

async function run(): PVoidT {
    unexpectListener()

    const conf = Conf.getServer()
    await Service.init()
    Server.listen(conf.port, () => {
        log.info('Elara server listen on port: ', conf.port)
    })
}

run()