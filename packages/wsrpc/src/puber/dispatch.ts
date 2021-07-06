import Http from 'http'
import { getAppLogger, dotenvInit } from 'lib'
dotenvInit()

const out = process.env.NODE_ENV == 'dev'
const log = getAppLogger('dispatch', out)


import Cacher from "../cacher"
import Matcher from "../matcher"
// import Recorder from '../recorder'
import Puber from '.'
import { Response } from '../util'
import { ReqDataT, WsData } from '../interface'

enum RpcTyp {
    Cacher = 'cache',
    Matcher = 'match',  
    Recorder = 'record',
    Direct  = 'direct'
}

const getRpcType = (method: string, params: any[]): RpcTyp => {
    if (params.length === 0 && Cacher.Rpcs.includes(method)) { 
        return RpcTyp.Cacher
    }
    if (Matcher.Rpcs.includes(method)) { return RpcTyp.Matcher }
    // if (Recorder.Rpcs.includes(method)) { return RpcTyp.Recorder }
    return RpcTyp.Direct
}

export const dispatchRpc = async (chain: string, data: ReqDataT, resp: Http.ServerResponse) => {
    const { id, jsonrpc, method, params } = data
    const typ = getRpcType(method, params)
    log.info(`new rpc request ${method} of chain ${chain}: ${typ}`)
    switch (typ) {
        case RpcTyp.Cacher:
            const res = { id, jsonrpc } as WsData
            const re: any = await Cacher.send(chain, method)
            log.info(`receive suducer result: ${JSON.stringify(re)}`)
            // TODO: updateTime check
            if (re.result) {
                res['result'] = JSON.parse(re.result)
                return Response.Ok(resp, JSON.stringify(res))
            }
            res.error = { code: 500, msg: 'error cache response' }
            return Response.Fail(resp, JSON.stringify(res), 500)
        case RpcTyp.Matcher:
            return Response.Ok(resp, 'ok')
            break
        case RpcTyp.Recorder:
            return Response.Ok(resp, 'ok')

            break
        case RpcTyp.Direct:
            return Response.Ok(resp, 'ok')
            break
    }
}

export const dispatchWs = async (chain: string, data: ReqDataT, puber: Puber) => {
    const {id, jsonrpc, method, params } = data
    const typ = getRpcType(method, params)
    log.info(`new ws request ${method} of chain ${chain}: ${typ}`)
    switch(typ) {
        case RpcTyp.Cacher:
            const res = {id, jsonrpc} as WsData
            const re = await Cacher.send(chain, method)
            if (re.result) {
                res['result'] = JSON.parse(re.result)
                return puber.ws.send(JSON.stringify(res))
            }
            res.error = {code: 500, msg: 'error cache response'}
            return puber.ws.send(JSON.stringify(res))
        case RpcTyp.Matcher:
            return puber.ws.send(JSON.stringify('ok'))

            break
        case RpcTyp.Recorder:
            return puber.ws.send(JSON.stringify('ok'))

            break
        case RpcTyp.Direct:
            return puber.ws.send(JSON.stringify('ok'))

            break
    }
}