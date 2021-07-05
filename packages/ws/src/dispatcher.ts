import Http from 'http'
import { getAppLogger } from "../../lib"

const log = getAppLogger('dispatcher', true)


import Suducer from "./pusumer/suducer"
import Matcher from "./pusumer/matcher"
import Pusumer from './pusumer'
import { Response } from './util'
import { ReqDataT, WsData } from './interface'
// import History from "./pusumer/history"

enum RpcTyp {
    Suducer = 'suducer',
    Matcher = 'matcher',
    History = 'history',
    Direct  = 'direct'
}

const getRpcType = (method: string, params: any[]): RpcTyp => {
    if (params.length === 0 && Suducer.Rpcs.includes(method)) { 
        return RpcTyp.Suducer
    }
    if (Matcher.Rpcs.includes(method)) { return RpcTyp.Matcher }
    // if (History.Rpcs.includes(method)) { return RpcTyp.History }
    return RpcTyp.Direct
}

// const response = () => {

// }

// const handleReq = async (chain: string, data: ReqDataT) => {
//     const { id, jsonrpc, method, params } = data
//     const typ = getRpcType(method, params)
//     log.info(`new rpc request ${method} of chain ${chain}: ${typ}`)
//     switch (typ) {
//         case RpcTyp.Suducer:
//             const re: any = await Suducer.send(chain, method, params)
//             log.info(`receive suducer result: ${JSON.stringify(re)}`)
//             // TODO: updateTime check
//             const res = { id, jsonrpc } as WsData
//             if (re.result) {
//                 res['result'] = re.result
//                 return Response.Ok(resp, JSON.stringify(res))
//             }
//             re.error = {code: 500, msg: 'error cache response'}
//             return Response.Fail(resp, JSON.stringify(res), 500)
//             break
//         case RpcTyp.Matcher:
//             break
//         case RpcTyp.History:
//             break
//         case RpcTyp.Direct:
//             break
//     }
// }

export const dispatchRpc = async (chain: string, dat: ReqDataT, resp: Http.ServerResponse) => {
    const { id, jsonrpc, method, params } = dat
    const typ = getRpcType(method, params)
    log.info(`new rpc request ${method} of chain ${chain}: ${typ}`)
    switch (typ) {
        case RpcTyp.Suducer:
            const res = { id, jsonrpc } as WsData
            if (Suducer.isSub(method)) {
                res.error = {code: -32090, msg: 'Subscriptions are not available on this transport.'}
                return Response.Ok(resp, JSON.stringify(res))
            }
            const re: any = await Suducer.send(chain, method, params)
            log.info(`receive suducer result: ${JSON.stringify(re)}`)
            // TODO: updateTime check
            if (re.result) {
                res['result'] = re.result
                return Response.Ok(resp, JSON.stringify(res))
            }
            re.error = {code: 500, msg: 'error cache response'}
            return Response.Fail(resp, JSON.stringify(res), 500)
            break
        case RpcTyp.Matcher:
            break
        case RpcTyp.History:
            break
        case RpcTyp.Direct:
            break
    }
}

export const dispatchWs = (chain: string, method: string, params: any[], pusumer: Pusumer) => {
    const typ = getRpcType(method, params)
    log.info(`new ws request ${method} of chain ${chain}: ${typ}`)
    pusumer
}