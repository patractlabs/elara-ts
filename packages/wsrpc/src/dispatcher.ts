import Http from 'http'
import { getAppLogger } from "../../lib"

const log = getAppLogger('dispatcher', true)


import Suducer from "./pusumer/suducer"
import Matcher from "./pusumer/matcher"
import Pusumer from './pusumer'
import { Response } from './util'
import { ReqDataT, WsData } from './interface'
import { Subscriber } from './mq'
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

export const dispatchRpc = async (chain: string, data: ReqDataT, resp: Http.ServerResponse) => {
    const { id, jsonrpc, method, params } = data
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
                res['result'] = JSON.parse(re.result)
                return Response.Ok(resp, JSON.stringify(res))
            }
            res.error = { code: 500, msg: 'error cache response' }
            return Response.Fail(resp, JSON.stringify(res), 500)
        case RpcTyp.Matcher:
            break
        case RpcTyp.History:
            break
        case RpcTyp.Direct:
            break
    }
}

export const dispatchWs = async (chain: string, data: ReqDataT, pusumer: Pusumer) => {
    const {id, jsonrpc, method, params } = data
    const typ = getRpcType(method, params)
    log.info(`new ws request ${method} of chain ${chain}: ${typ}`)
    switch(typ) {
        case RpcTyp.Suducer:
            const res = {id, jsonrpc} as WsData
            if (Suducer.isSub(method)) {
                // subscribe redis stream
                // TODO: cache the subscribe context
                const suber = new Subscriber()

                const subsId = suber.subscribe(`${chain}-${method}`, (dat: any) => {
                    if (dat.result) {

                        log.info('first subscribe response')
                        res.result = dat.result
                        res.method = method
                        return pusumer.ws.send(JSON.stringify(res))
                    }
                    dat = JSON.parse(dat[0][1][1])
                    res.params = {}
                    res.params['result'] = dat
                    res.params['subscription'] = 'sdfsdauiegnj'
                    log.info(`new subscribe response: ${res}`)
                    pusumer.ws.send(JSON.stringify(res))
                })
                subsId
                // TODO unsubscribe
                return
            } 
            const re = await Suducer.sendCache(chain, method)
            if (re.result) {
                res['result'] = JSON.parse(re.result)
                return pusumer.ws.send(JSON.stringify(res))
            }
            res.error = {code: 500, msg: 'error cache response'}
            return pusumer.ws.send(JSON.stringify(res))
        case RpcTyp.Matcher:
            break
        case RpcTyp.History:
            break
        case RpcTyp.Direct:
            break
    }
}