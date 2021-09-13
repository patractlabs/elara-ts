import WebSocket from 'ws'
import { IDT, getAppLogger, Err, Ok, ResultT, PResultT, isErr, PVoidT, isNone, Option, PBoolT } from '@elara/lib'
import GG from '../global'
import { WsData, ReqT, ReqTyp, ReqDataT, CloseReason, Statistics } from '../interface'
import Puber from '../puber'
import Suber from './suber'
import { NodeType } from '../chain'
import { md5, randomId } from '@elara/lib'
import Conf from '../../config'
import Topic from './topic'

const log = getAppLogger('matcher')

async function isConnOutOfLimit(ws: WebSocket, chain: string, pid: IDT): PBoolT {
    if (pid === '00000000000000000000000000000000') { return false }
    const wsConf = Conf.getWsPool()
    const curConn = GG.getConnCnt(chain, pid)
    log.info(`current ws connection of chain ${chain} pid[${pid}]: ${curConn}/${wsConf.maxConn}`)
    if (curConn >= wsConf.maxConn) {
        log.error(`${chain} pid[${pid}] out of connection limit`)
        ws.close(1002, 'Out of connection limit')
        return true
    }
    return false
}

// subcribe request
function isSubReq(method: string): boolean {
    return Topic.subscribe.indexOf(method) !== -1
}

function isUnsubReq(method: string): boolean {
    return Topic.unsubscribe.indexOf(method) !== -1
}

function remSuberPubers(chain: string, subType: NodeType, subId: IDT, pubId: IDT): void {
    /// suber may be closed 
    let re = Suber.getSuber(chain, subType, subId)
    if (isNone(re)) {
        log.error(`handle puber[${pubId}] close error: invalid ${chain} suber ${subId} type ${subType}, may closed`)
        // process.exit(2)
        return
    }
    const suber = re.value
    suber.pubers?.delete(pubId)
    Suber.updateOrAddSuber(chain, subType, suber)
}

async function clearSubscribeContext(puber: Puber, reason: CloseReason): PVoidT {
    const ptopics = puber.topics || new Set()
    if (reason === CloseReason.Node) {
        remSuberPubers(puber.chain, NodeType.Kv, puber.kvSubId!, puber.id)
    } else if (reason === CloseReason.Kv) {
        remSuberPubers(puber.chain, NodeType.Node, puber.subId, puber.id)
    } else {
        if (puber.kvSubId !== undefined) {
            remSuberPubers(puber.chain, NodeType.Kv, puber.kvSubId!, puber.id)
        }
        remSuberPubers(puber.chain, NodeType.Node, puber.subId, puber.id)
    }

    if (ptopics.size < 1) {
        // delete puber
        // NOTE: subscribe may not response yet
        // TODO: check request cache
        Puber.del(puber.id)
        log.info(`handle puber ${puber.id} close done: no subscribe topic`)
        return
    }
    // clear puber when unscribe done
    const evt = GG.getPuberEvent()
    evt.once(`${puber.id}-done`, () => {
        // if suber closed, event need to emit on suber closed
        Puber.del(puber.id)
        evt.removeAllListeners(`${puber.id}-done`)
        log.info(`unsubsribe event done: clear ${puber.chain} pid[${puber.pid}] subscribe context of puber[${puber.id}] close done`)
    })

    const { chain, pid } = puber
    for (let subsId of ptopics) {
        const subRe = GG.getSubTopic(chain, pid, subsId)
        if (isErr(subRe)) {
            log.error(`unsubscribe when puber clsoe error: ${subRe.value}`)
            process.exit(2)
        }
        const topic = subRe.value
        const re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`unsubscribe when puber clsoe error: ${re.value}`)
            process.exit(2)
        }
        const reqId = re.value
        const reqRe = GG.getReqCache(reqId)
        if (isErr(reqRe)) {
            log.error(`unsubscribe when puber clsoe error: ${reqRe.value}`)
            process.exit(2)
        }
        const req = reqRe.value
        const unre = await Suber.unsubscribe(chain, req.subType, req.subId, topic.method, subsId)
        if (isErr(unre)) {
            evt.emit(`${puber.id}-done`)
            log.warn(`chain ${chain} ${req.subType} suber ${req.subId} has been closed, emit unsubscribe done`)
            break
        }
        log.info(`unsubscribe topic[${topic.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${req.subId}] ${req.subType}`)
    }
    log.info(`handle ${chain} pid[${pid}] puber[${puber.id}] close done: unsubscribe all topics`)
}

async function suberBind(chain: string, puber: Puber, type: NodeType): PResultT<Suber> {
    let re = await Suber.selectSuber(chain, type)
    if (isErr(re)) {
        return re
    }
    let suber = re.value as Suber
    suber.pubers = suber.pubers || new Set<IDT>()
    suber.pubers.add(puber.id)
    Suber.updateOrAddSuber(chain, type, suber)
    switch (type) {
        case NodeType.Kv:
            puber.kvSubId = suber.id
            log.info(`${chain} puber[${puber.id}] bind to ${type} suber[${suber.id}]`)
            break
        case NodeType.Mem:
            puber.memSubId = suber.id
            log.info(`${chain} puber[${puber.id}] bind to ${type} suber[${suber.id}]`)
            break
        case NodeType.Node:
            puber.subId = suber.id
            log.info(`${chain} puber[${puber.id}] bind to ${type} suber[${suber.id}]`)
            break
        default:
            log.error(`bind suber error: invalid suber type[${type}]`)
            process.exit(1)
    }
    return Ok(suber)
}

class Matcher {

    static async regist(ws: WebSocket, chain: string, pid: IDT): PResultT<Puber> {
        const isOut = await isConnOutOfLimit(ws, chain, pid)
        if (isOut) { return Err(`connection out of limit`) }

        // create new puber 
        const puber = Puber.create(ws, chain, pid)
        let re = await suberBind(chain, puber, NodeType.Node)
        if (isErr(re)) {
            log.error(`${chain}-${pid} bind node suber error: %o`, re.value)
            return Err(`${chain}-${pid} bind node suber error`)
        }
        puber.nodeId = re.value.nodeId
        const kvOpen = GG.getKvEnable(chain)
        const memOpen = GG.getMemEnable(chain)
        log.debug(`puber before bind: kv[%o] mem[%o]`, puber.kvSubId, puber.memSubId)

        if (kvOpen) {
            re = await suberBind(chain, puber, NodeType.Kv)
            if (isErr(re)) {
                log.error(`${chain}-${pid} bind node suber error: %o`, re.value)
                return Err(`${chain}-${pid} bind node suber error`)
            }
            log.debug(`puber after bind kv:  kv[%o] mem[%o]`, puber.kvSubId, puber.memSubId)
        }

        if (memOpen) {
            re = await suberBind(chain, puber, NodeType.Mem)
            if (isErr(re)) {
                log.error(`${chain}-${pid} bind node suber error: %o`, re.value)
                return Err(`${chain}-${pid} bind node suber error`)
            }
            log.debug(`puber after bind memory node: kv[%o] mem[%o]`, puber.kvSubId, puber.memSubId)
        }

        // update puber.subId
        Puber.updateOrAdd(puber)

        GG.incrConnCnt(chain, puber.pid)
        log.info(`regist ${chain} puber[${puber.id}] done`)
        return Ok(puber)
    }

    static newRequest(chain: string, pid: IDT, pubId: IDT, subType: NodeType, subId: IDT, data: ReqDataT, stat: Statistics): ResultT<ReqDataT> {
        const method = data.method!
        let type = ReqTyp.Rpc
        let subsId
        if (isUnsubReq(method)) {
            log.info(`${chain} pid[${pid}] pre handle unsubscribe request: ${method}: %o`, data.params)
            if (data.params!.length < 1 || !Suber.isSubscribeID(data.params![0])) {
                return Err(`invalid unsubscribe params: ${data.params![0]}`)
            }
            type = ReqTyp.Unsub
            subsId = data.params![0]
        } else if (isSubReq(method)) {
            type = ReqTyp.Sub
            stat.reqCnt = 1 // for first response
            stat.bw = 0
        }

        const req = {
            id: randomId(),
            pubId,
            chain,
            pid,
            subType,
            subId,
            originId: data.id,
            jsonrpc: data.jsonrpc,
            type,
            method,
            params: data.params,
            subsId,
            stat
        } as ReqT
        log.info(`new ${chain} ${pid} ${subType} request cache: ${JSON.stringify(req)}`)
        GG.addReqCache(req)

        data.id = req.id as string
        return Ok(data)
    }

    // according to message set the subscribe context
    static setSubContext(req: ReqT, subsId: string): ResultT<void> {
        // update subscribe request cache
        req.subsId = subsId
        GG.updateReqCache(req)

        // update submap
        GG.addSubReqMap(subsId, req.id)

        // update puber.topics
        let re = Puber.updateTopics(req.pubId, subsId)
        if (isErr(re)) {
            return Err(`update puber topics error: ${re.value}`)
        }
        const puber = re.value as Puber

        // add new subscribed topic
        GG.addSubTopic(puber.chain, puber.pid, { id: subsId, pubId: req.pubId, method: req.method, params: req.params })
        return Ok(void (0))
    }

    static async unRegist(pubId: IDT, reason: CloseReason): PVoidT {
        /// when puber error or close,
        /// if suber close or error, will emit puber close

        let re: Option<any> = Puber.get(pubId)
        if (isNone(re) || !re.value.subId) {
            // SBH
            log.error(`[SBH] Unregist puber error: invalid puber ${pubId}`)
            process.exit(1)
        }
        const puber = re.value as Puber

        GG.decrConnCnt(puber.chain, puber.pid)

        clearSubscribeContext(puber, reason)
    }

    static isSubscribed(chain: string, pid: IDT, data: WsData): boolean {
        if (pid === '00000000000000000000000000000000') { return false }
        const topics = GG.getSubTopics(chain, pid)
        for (let id in topics) {
            const sub = topics[id]
            const sMthod = sub.method === data.method
            const sParams = md5(JSON.stringify(sub.params)) === md5(JSON.stringify(data.params))
            if (sMthod && sParams) {
                return true
            }
        }
        return false
    }

    static async init(): PVoidT {
        Suber.init()
    }
}

export default Matcher