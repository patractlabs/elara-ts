import Http from 'http'
import { getAppLogger, PVoidT } from '@elara/lib'
import Cacher from "../cacher"
// import Recorder from '../recorder'
import Puber from '.'
import Response from '../resp'
import { ReqDataT, Statistics, WsData } from '../interface'
import Topic from '../matcher/topic'
import Noder from '../noder'
import Kver from '../kver'
import Util from '../util'
import { Stat } from '../statistic'

const log = getAppLogger('dispatch')

enum RpcTyp {
    Cacher = 'cache',
    Kver = 'kv',
    Recorder = 'record',
    Noder = 'node'
}

function getRpcType(method: string, params: string[]): RpcTyp {
    if (params.length === 0 && Cacher.Rpcs.includes(method)) {
        return RpcTyp.Cacher
    } else if (Kver.Rpcs.includes(method)) {
        return RpcTyp.Kver
    }
    // if (Recorder.Rpcs.includes(method)) { return RpcTyp.Recorder }
    return RpcTyp.Noder
}

export async function dispatchRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse, stat: Statistics): PVoidT {
    const { id, jsonrpc, method, params } = data
    log.info(`new rpc request ${method} of chain ${chain}`)

    // filter subscribe
    if (Topic.subscribe.includes(method) || method.includes('subscribe')) {
        let res = { id, jsonrpc } as WsData
        res.error = { code: -32090, message: 'Subscriptions are not available on this transport.' }
        return Response.Fail(resp, JSON.stringify(res), 400, stat)
    }
    const typ = getRpcType(method, params!)
    stat.type = typ
    const res = { id, jsonrpc } as WsData
    switch (typ) {
        case RpcTyp.Cacher:
            if (Cacher.statusOk(chain)) {
                const re: any = await Cacher.send(chain, method)
                // log.info(`receive cacher result: ${JSON.stringify(re)}`)
                // TODO: updateTime check
                if (re.result) {
                    res['result'] = JSON.parse(re.result)
                    return Response.Ok(resp, JSON.stringify(res), stat)
                }
                res.error = { code: 3000, message: 'error cache response' }
                return Response.Fail(resp, JSON.stringify(res), 500, stat)
            }
            // noder
            log.error(`chain ${chain} rpc cacher fail, transpond to noder method[${method}] params[${params}]`)
            return Noder.sendRpc(chain, data, resp, stat)
        case RpcTyp.Recorder:
            res.result = `recoder: ${method}`
            return Response.Ok(resp, JSON.stringify(res), stat)
        case RpcTyp.Noder:
            res.result = `direct: ${method}`
            return Noder.sendRpc(chain, data, resp, stat)
        default:
            log.error(`[SBH] no this rpc request type: ${typ}`)
            break
    }
}

export async function dispatchWs(chain: string, data: ReqDataT, puber: Puber, stat: Statistics): PVoidT {
    const { id, jsonrpc, method, params } = data
    const typ = getRpcType(method, params!)
    stat.type = typ
    stat.code = 200
    log.debug(`new ${typ} ws request ${method} of chain ${chain} params: `, params)
    switch (typ) {
        case RpcTyp.Cacher:
            if (Cacher.statusOk(chain)) {// no need to clear puber.subid and suber.pubers
                const res = { id, jsonrpc } as WsData
                const re = await Cacher.send(chain, method)
                if (re.result) {
                    res['result'] = JSON.parse(re.result)
                    const ress = JSON.stringify(res)
                    stat.delay = Util.traceDelay(stat.start)
                    stat.bw = Util.strBytes(ress)
                    stat.reqCnt = 1
                    Stat.publish(stat)
                    return puber.ws.send(ress)
                }
                res.error = { code: 500, message: 'error cache response' }
                stat.code = 500
                stat.delay = Util.traceDelay(stat.start)
                Stat.publish(stat)
                return puber.ws.send(JSON.stringify(res))
            }
            log.error(`chain ${chain} ws cacher fail, transpond to noder method[${method}] params[${params}]`)
            return Noder.sendWs(puber, data, stat)
        case RpcTyp.Kver:
            if (puber.kvSubId !== undefined) {
                return Kver.send(puber, data, stat)
            }
            log.debug(`chain ${chain} kv is not support, transpond to noder`)
            return Noder.sendWs(puber, data, stat)
        case RpcTyp.Recorder:
            return puber.ws.send(JSON.stringify('ok'))
        case RpcTyp.Noder:
            return Noder.sendWs(puber, data, stat)
        default:
            log.error(`[SBH] no this ws request type: ${typ}`)
            break
    }
}