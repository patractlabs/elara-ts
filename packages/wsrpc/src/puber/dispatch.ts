import Http from 'http'
import { getAppLogger, PVoidT } from '@elara/lib'
import Puber from '.'
import Response from '../resp'
import { ReqDataT, Statistics, WsData } from '../interface'
import Topic from '../matcher/topic'
import { Kver, Noder, Cacher } from '../suber'
import Util from '../util'
import { Stat } from '../statistic'
import G from '../global'
import { NodeType } from '../chain'

const log = getAppLogger('dispatch')

enum RpcTyp {
    Cacher = 'cache',
    Kver = 'kv',
    Recorder = 'record',
    Noder = 'node',
    MemNoder = 'memory'
}

function getRpcType(method: string, params: any[]): RpcTyp {
    if ((params[0] === 0 || params.length === 0) && Cacher.Rpcs.includes(method)) {
        return RpcTyp.Cacher
    } else if (Kver.Rpcs.includes(method)) {
        return RpcTyp.Kver
    } else if (Object.keys(Noder.memRpcs).includes(method)) {
        // log.debug(`memory node rpc request: ${method} %o`, params)
        const pLen = Noder.memRpcs[method]
        const len = params.length
        if (len != pLen || (params[len - 1] === null || params[len - 1] === undefined)) {
            return RpcTyp.MemNoder
        }
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
                let tmethod = method
                if (method === 'chain_getBlockHash' && (params?.length === 1 && params[0] === 0)) {
                    log.debug(`${chain} get rpc initial block hash`)
                    tmethod = `${method}_0`
                }
                const re: any = await Cacher.send(chain, tmethod)
                // log.info(`receive cacher result: ${JSON.stringify(re)}`)
                // TODO: updateTime check
                if (re.result) {
                    res['result'] = JSON.parse(re.result)
                    return Response.Ok(resp, JSON.stringify(res), stat)
                }
                log.error(`${chain} cache response error: ${method}`)
                // res.error = { code: 3000, message: 'error cache response' }
                // return Response.Fail(resp, JSON.stringify(res), 500, stat)
            }
            // noder
            log.error(`chain ${chain} rpc cacher fail, transpond to noder method[${method}] params[${params}]`)
            return Noder.sendRpc(chain, data, resp, stat)
        case RpcTyp.Recorder:
            res.result = `recoder: ${method}`
            return Response.Ok(resp, JSON.stringify(res), stat)
        case RpcTyp.MemNoder:
            // TODO: memory node fail
            const isSupport = G.getSuberEnable(chain, NodeType.Mem)
            const statOk = G.getServerStatus(chain, NodeType.Mem)
            if (isSupport && statOk) {
                return Noder.sendMemRpc(chain, data, resp, stat)
            }
            log.warn(`${chain} memory node support[${isSupport}] suber status ok[${statOk}], transpond to noder`)
            return Noder.sendRpc(chain, data, resp, stat)
        case RpcTyp.Noder:
            return Noder.sendRpc(chain, data, resp, stat)
        default:
            log.error(`[SBH] no this rpc request type: ${typ}`)
            break
    }
}

export async function dispatchWs(chain: string, data: ReqDataT, puber: Puber, stat: Statistics): PVoidT {
    const { id, jsonrpc, method, params } = data
    // const { nodeId } = puber
    const typ = getRpcType(method, params!)
    stat.type = typ
    stat.code = 200
    let isSupport = false
    let statOk = false
    // log.debug(`new ${typ} ws request ${method} of chain ${chain}-${nodeId} params: %o\n handle msg delay: ${Util.traceEnd(stat.start)}`, params)
    switch (typ) {
        case RpcTyp.Cacher:
            if (Cacher.statusOk(chain)) {// no need to clear puber.subid and suber.pubers
                const res = { id, jsonrpc } as WsData
                let tmethod = method
                // cache for block hash at 0 block number
                if (method === 'chain_getBlockHash' && (params?.length === 1 && params[0] === 0)) {
                    // log.debug(`${chain}-${nodeId} get ws initial block hash`)
                    tmethod = `${method}_0`
                }
                const re = await Cacher.send(chain, tmethod)

                if (re.result) {
                    // log.info(`${chain}-${nodeId} ${typ} cacher result: %o`, re.result)
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
                // return puber.ws.send(JSON.stringify(res))
            }
            // log.error(`${chain}-${nodeId} ws cacher fail, transpond to noder method[${method}] params[${params}]`)
            return Noder.sendWs(puber, data, stat)
        case RpcTyp.Kver:
            isSupport = G.getSuberEnable(chain, NodeType.Kv)
            statOk = G.getServerStatus(chain, NodeType.Kv)

            if (isSupport && statOk && puber.kvSubId !== undefined) {
                return Kver.send(puber, data, stat)
            }
            // log.warn(`${chain}-${nodeId} kv support[${isSupport}] suber status ok[${statOk}], transpond to noder`)
            return Noder.sendWs(puber, data, stat)
        case RpcTyp.Recorder:
            return puber.ws.send(JSON.stringify('ok'))
        case RpcTyp.MemNoder:
            isSupport = G.getSuberEnable(chain, NodeType.Mem)
            statOk = G.getServerStatus(chain, NodeType.Mem)

            if (isSupport && statOk && puber.memSubId !== undefined) {
                return Noder.sendMemWs(puber, data, stat)
            }
            // log.warn(`${chain}-${nodeId} memory support[${isSupport}] suber status ok[${statOk}], transpond to noder`)
            return Noder.sendWs(puber, data, stat)
        case RpcTyp.Noder:
            return Noder.sendWs(puber, data, stat)
        default:
            log.error(`[SBH] no this ws request type: ${typ}`)
            break
    }
}