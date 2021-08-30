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
import Dao from './src/dao'

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

async function projectOk(chain: string, pid: string): PBoolT {
    if (pid === '00000000000000000000000000000000') {
        return true
    }
    const pstat = await Dao.getProjectStatus(chain, pid)
    log.info(`get ${chain} project[${pid}] status resutl: %o`, pstat)
    if (pstat.status === undefined) {
        return false
    }
    return true
}

async function resourceLimit(chain: string, pid: string): PBoolT {
    if (pid === '00000000000000000000000000000000') {
        return false
    }
    
    const pstat = await Dao.getProjectStatus(chain, pid)
    log.info(`project status ${pstat['status']}: %o`, pstat)
    if (pstat.status !== 'active') {
        return true
    }
    const userId = parseInt(pstat.user)
    const ustat = await Dao.getUserStatus(userId)
    log.info(`user status: %o`, ustat)
    
    if (ustat.status !== 'active') {
        return true
    }
    return false
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
    const {chain, pid} = re.value as ChainPidT
    const projectIsOk = await projectOk(chain, pid as string)
    if (!projectIsOk) {
        return Response.Fail(res, 'invalid project', 400, reqStatis)
    }
    let data = ''
    let dstart = 0
    reqStatis.chain = chain
    reqStatis.pid = pid as string

    req.on('data', (chunk) => {
        if (data == '') {
            dstart = Util.traceStart()
        }
        data += chunk
    })

    req.on('end', async () => {
        const dtime = Util.traceEnd(dstart)
        log.info(`${chain} pid[${pid}] new rpc request: ${data}, parse time[${dtime}]`)
        let dat: ReqDataT
        try {
            let re = dataCheck(data)
            if (isErr(re)) {
                log.error(`${chain} pid[${pid}] rpc request error: ${re.value}`)
                return Response.Fail(res, re.value, 400, reqStatis)
            }
            dat = re.value
            reqStatis.req = dat
            const isLimit = await resourceLimit(chain, pid as string)
            if (isLimit) {
                return Response.Fail(res, 'resource out of limit', 419, reqStatis)
            }
        } catch (err) {
            log.error(`${chain} pid[${pid}] rpc request catch error: %o`, err)
            return Response.Fail(res, 'Invalid request, must be JSON {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}', 400, reqStatis)
        }
        // dispatch request 
        dispatchRpc(chain, dat, res, reqStatis)
    })
})

// WebSocket request 
Server.on('upgrade', async (req: Http.IncomingMessage, socket: Net.Socket, head): PVoidT => {
    const path = req.url!
    const re = await Util.urlParse(path)
    let reqStatis = initStatistic('ws', req.method!, req.headers)
    reqStatis.type = 'conn'

    if (isErr(re)) {
        log.error('Invalid socket request: %o', re.value)
        // 
        reqStatis.code = 400
        // publish statistics
        Stat.publish(reqStatis)
        await socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
    }
    const { chain, pid } = re.value
    const projectIsOk = await projectOk(chain, pid as string)
    if (!projectIsOk) {
        Stat.publish(reqStatis)
        await socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
    }
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
        log.error(`${chain} pid[${pid}] socket connect error: ${re.value}`)
        if (re.value.includes('suber inactive')) {
            log.error(`${chain} pid[${pid}] suber is unavailable`)
            ws.send(`service unavailable now`)
        }
        stat.code = 500
        // publish statistics
        Stat.publish(stat)
        return ws.terminate()
    }
    const puber = re.value as Puber
    log.info(`New socket connection chain ${chain} pid[${pid}], current total connections: %o`, wss.clients.size)
    const id = puber.id
    stat.code = 200
    // publish statistics
    Stat.publish(stat)

    ws.on('message', async (data) => {
        log.info(`${chain} pid[${pid}] new puber[${id}] request of chain ${chain}: %o`, data)
        let dat: ReqDataT
        let reqStatis = initStatistic('ws', '', {} as Http.IncomingHttpHeaders)
        reqStatis.code = 400
        reqStatis.chain = chain
        reqStatis.pid = pid
        reqStatis.header = stat.header

        try {
            let re = dataCheck(data.toString())
            if (isErr(re)) {
                log.error(`${chain} pid[${pid}] puber[${id}] data check error: ${re.value}`)
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
            log.error(`${chain} pid[${pid}] puber[${id}] parse request to JSON error`)
            // publis statistics
            reqStatis.delay = Util.traceDelay(reqStatis.start)
            reqStatis.code = 500
            Stat.publish(reqStatis)
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }
        reqStatis.code = 200
        dispatchWs(req.chain, dat, puber, reqStatis)
    })

    ws.on('close', async (code, reason) => {
        log.error(`${chain} pid[${pid}] puber[${id}] close: ${reason}, code ${code}, reason[${reason}]\n \tcurrent total puber connections: %o`, wss.clients.size)
        if (reason === CloseReason.OutOfLimit || reason === CloseReason.SuberUnavail) {
            return  // out of limit
        }
        Matcher.unRegist(id, reason as CloseReason)

        const projectIsOk = await projectOk(chain, pid)
        if (!projectIsOk) {
            // clear project statistic
            log.warn(`${chain} project[${pid}] is deleted, clear statistic now`)
            Dao.clearProjectStatistic(chain, pid)
        }
    })

    ws.on('error', (err) => {
        log.error(`${chain} pid[${pid}] Puber[${id}] Connection error: %o`, err)
    })
    return
})

async function run(): PVoidT {
    unexpectListener()

    await Service.init()



    Server.listen(conf.port, () => {
        log.info(`Elara server listen on port: ${conf.port}`)
    })
}

run()