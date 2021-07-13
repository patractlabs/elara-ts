import Http from 'http'
import { getAppLogger, PVoidT } from 'lib'
import Cacher from "../cacher"
// import Recorder from '../recorder'
import Puber from '.'
import { Response } from '../util'
import { ReqDataT, WsData } from '../interface'
import Topic from '../matcher/topic'
import Noder from '../noder'
import Kver from '../kver'

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

export async function dispatchRpc(chain: string, data: ReqDataT, resp: Http.ServerResponse): PVoidT {
    const { id, jsonrpc, method, params } = data
    log.info(`new rpc request ${method} of chain ${chain}`)

    // filter subscribe
    if (Topic.subscribe.includes(method) || method.includes('subscribe')) {
        let res = { id, jsonrpc } as WsData
        res.error = { code: -32090, message: 'Subscriptions are not available on this transport.' }
        return Response.Ok(resp, JSON.stringify(res))
    }
    const typ = getRpcType(method, params!)
    const res = { id, jsonrpc } as WsData
    switch (typ) {
        case RpcTyp.Cacher:
            if (Cacher.statusOk()) {
                const re: any = await Cacher.send(chain, method)
                // log.info(`receive cacher result: ${JSON.stringify(re)}`)
                // TODO: updateTime check
                if (re.result) {
                    res['result'] = JSON.parse(re.result)
                    return Response.Ok(resp, JSON.stringify(res))
                }
                res.error = { code: 3000, message: 'error cache response' }
                return Response.Fail(resp, JSON.stringify(res), 500)
            }
            // noder
            return Noder.sendRpc(chain, data, resp)
        case RpcTyp.Recorder:
            res.result = `recoder: ${method}`
            return Response.Ok(resp, JSON.stringify(res))
        case RpcTyp.Noder:
            res.result = `direct: ${method}`
            return Noder.sendRpc(chain, data, resp)
        default:
            log.error(`[SBH] no this rpc request type: ${typ}`)
            break
    }
}

export async function dispatchWs(chain: string, data: ReqDataT, puber: Puber): PVoidT {
    const { id, jsonrpc, method, params } = data
    const typ = getRpcType(method, params!)
    log.debug(`new ${typ} ws request ${method} of chain ${chain} params: `, params)
    switch (typ) {
        case RpcTyp.Cacher:
            if (Cacher.statusOk()) {// no need to clear puber.subid and suber.pubers
                const res = { id, jsonrpc } as WsData
                const re = await Cacher.send(chain, method)
                if (re.result) {
                    res['result'] = JSON.parse(re.result)
                    return puber.ws.send(JSON.stringify(res))
                }
                res.error = { code: 500, message: 'error cache response' }
                return puber.ws.send(JSON.stringify(res))
            }
            return Noder.sendWs(puber, data)
        case RpcTyp.Kver:
            return Kver.send(puber, data)
        case RpcTyp.Recorder:
            return puber.ws.send(JSON.stringify('ok'))
        case RpcTyp.Noder:
            return Noder.sendWs(puber, data)
        default:
            log.error(`[SBH] no this ws request type: ${typ}`)
            break
    }
}