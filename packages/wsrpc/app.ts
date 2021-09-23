import Http from 'http'
import Net from 'net'
import { getAppLogger, isErr, PResultT, PVoidT, unexpectListener } from '@elara/lib'
import Util from './src/util'
import { ChainPidT, ReqDataT } from './src/interface'
import Conf from './config'
import { dispatchRpc } from './src/puber'
import Service from './src/service'
import Response from './src/resp'
import { Stat } from './src/statistic'
import G from './src/global'
import Emiter from './src/emiter'
import { NodeType } from './src/chain'
import PuberPool from './src/puber/pool'
import Matcher from './src/matcher'

const conf = Conf.getServer()
const log = getAppLogger('app')
const Server = Http.createServer()

async function pathOk(url: string, host: string): PResultT<ChainPidT> {
    let nurl = new URL(url, `http://${host}`)
    let path = nurl.pathname
    // chain pid valid check
    return Util.urlParse(path)
}

function isPostMethod(method: string): boolean {
    return method === 'POST'
}

// Http rpc request 
Server.on('request', async (req: Http.IncomingMessage, res: Http.ServerResponse) => {
    // method check
    let reqStatis = Stat.build('http', req.method!, req.headers)
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

    const { chain, pid } = re.value as ChainPidT
    const projectIsOk = await Matcher.projectOk(chain, pid as string)
    if (!projectIsOk) {
        log.error(`${chain} project[${pid}] check failed, no this pid!`)
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
            let re = Util.rpcCheck(data)
            if (isErr(re)) {
                log.error(`${chain} pid[${pid}] rpc request error: ${re.value}`)
                return Response.Fail(res, re.value, 400, reqStatis)
            }
            dat = re.value
            reqStatis.req = dat
            const isLimit = await Matcher.resourceLimitOk(chain, pid as string)
            if (isErr(isLimit)) {
                log.error(`${chain} pid[${pid}] resource limit: %o`, isLimit.value)
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
    const start = Util.traceStart()
    const path = req.url!
    const re = await Util.urlParse(path)
    let reqStatis = Stat.build('ws', req.method!, req.headers)
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
    // chain node ok
    if (!G.getServerStatus(chain, NodeType.Node)) {
        log.error(`${chain} service unavailable now`)
        await socket.end(`HTTP/1.1 500 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
    }
    const projectIsOk = await Matcher.projectOk(chain, pid as string)
    if (!projectIsOk) {
        log.error(`${chain} [${pid}] check failed, no this pid!`)
        Stat.publish(reqStatis)
        await socket.end(`HTTP/1.1 400 ${re.value} \r\n\r\n`, 'ascii')
        socket.emit('close', true)
        return
    }
    reqStatis.chain = chain
    reqStatis.pid = pid as string

    // only handle urlReg pattern request
    const wss = PuberPool.get(chain)
    wss.handleUpgrade(req, socket as any, head, (ws, req: any) => {
        req['chain'] = chain
        req['pid'] = pid
        req['stat'] = reqStatis
        req['trace'] = start
        wss.emit('connection', ws, req)
    })
})

async function run(): PVoidT {
    unexpectListener()

    const elaraEmiter = new Emiter('elara-init', async () => {
        log.info(`Elara init done`)
        await PuberPool.init()

        Server.listen(conf.port, () => {
            log.info(`Elara server listen on port: ${conf.port}`)
        })
    }, 1)

    await Service.init(elaraEmiter)
}

run()