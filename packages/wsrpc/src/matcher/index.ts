/// manager ws socket pair 
/// 1. dapps fail
///     - part connectin fail, regist matcher to valid connection
///     - all fail, clear all matcher bind to this dapp
/// 2. elara fail
///     - all connection fail, need dapps to reconnect
/// 3. node fail
///     - node recover in soon(e.g. 10s), keep the puber connection, regist matchers
///     - node fail longtime, clear all pubers and matchers

import WebSocket from 'ws'
import EventEmitter from 'events'
import { IDT, getAppLogger, Err, Ok, ResultT, PResultT, isErr, PVoidT, isNone, Option, PBoolT } from 'lib'
import GG from '../global'
import { WsData, ReqT, ReqTyp, ReqDataT } from '../interface'
import Puber from '../puber'
import Suber, { SuberTyp } from './suber'
import { md5, randomId } from 'lib/utils'
import Util from '../util'
import Conf from '../../config'
import Topic from './topic'

const log = getAppLogger('matcher')

async function isConnOutOfLimit(ws: WebSocket, chain: string, pid: IDT): PBoolT {
    const wsConf = Conf.getWsPool()
    const curConn = GG.getConnCnt(chain, pid)
    log.info(`current ws connection of chain ${chain} pid[${pid}]: ${curConn}/${wsConf.maxConn}`)
    if (curConn >= wsConf.maxConn) {
        ws.close(1002, 'Out of connection limit')
        return true
    }
    return false
}

function isSubReq(method: string): boolean {
    return Topic.subscribe.indexOf(method) !== -1
}

function isUnsubReq(method: string): boolean {
    return Topic.unsubscribe.indexOf(method) !== -1
}

namespace Matcher {

    export const regist = async (ws: WebSocket, chain: string, pid: IDT): PResultT<Puber> => {
        const isOut = await isConnOutOfLimit(ws, chain, pid)
        if (isOut) { return Err(`connection out of limit`) }

        let ren = await Suber.selectSuber(chain, SuberTyp.Node)
        if (isErr(ren)) { return ren }
        const suber = ren.value as Suber

        let rek = await Suber.selectSuber(chain, SuberTyp.Kv)
        if (isErr(rek)) { return rek }
        const kvSuber = rek.value as Suber

        // create new puber 
        const puber = Puber.create(ws, chain, pid)

        // update suber.pubers
        suber.pubers = suber.pubers || new Set<IDT>()
        suber.pubers.add(puber.id)
        GG.updateOrAddSuber(chain, SuberTyp.Node, suber)

        kvSuber.pubers = suber.pubers || new Set<IDT>()
        kvSuber.pubers.add(puber.id)
        GG.updateOrAddSuber(chain, SuberTyp.Kv, kvSuber)

        // update puber.subId
        puber.subId = suber.id
        puber.kvSubId = kvSuber.id
        Puber.G.updateOrAdd(puber)

        // side context set
        GG.incrConnCnt(chain, puber.pid)
        log.info(`regist puber[${puber.id}] to node suber[${suber.id}] kv suber[${kvSuber.id}]: `, Util.globalStat())
        return Ok(puber)
    }

    export const newRequest = (chain: string, pid: IDT, pubId: IDT, subType: SuberTyp, subId: IDT, data: ReqDataT): ResultT<ReqDataT> => {
        const method = data.method!
        let type = ReqTyp.Rpc

        if (isUnsubReq(method)) {
            log.info(`pre handle unsubscribe request: ${method}: `, data.params, Suber.isSubscribeID(data.params![0]))
            type = ReqTyp.Unsub
            if (data.params!.length < 1 || !Suber.isSubscribeID(data.params![0])) {
                return Err(`invalid unsubscribe params: ${data.params![0]}`)
            }
        } else if (isSubReq(method)) {
            type = ReqTyp.Sub
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
            params: data.params
        } as ReqT
        log.debug(`new ${chain} ${pid} ${subType} request cache: ${JSON.stringify(req)}`)
        GG.addReqCache(req)

        data.id = req.id as string
        log.info(`global stat after new request[${req.id}] : `, Util.globalStat())
        return Ok(data)
    }

    // according to message set the subscribe context
    export const setSubContext = (req: ReqT, subsId: string): ResultT<void> => {
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

        log.info(`After set subscribe context requestId[${req.id}] global stat: `, Util.globalStat())    // for test
        return Ok(void (0))
    }

    const remSuberPubers = (chain: string, subType: SuberTyp, subId: IDT, pubId: IDT): void => {
        let re = GG.getSuber(chain, subType, subId)
        if (isNone(re)) {
            log.error(`[SBH] handle puber close error: invalid ${chain} suber ${subId} type ${subType}`)
            process.exit(2)
        }
        const suber = re.value
        suber.pubers?.delete(pubId)
        GG.updateOrAddSuber(chain, subType, suber)
    }

    const clearSubscribeContext = (puber: Puber, reason: Puber.CloseReason) => {
        const ptopics = puber.topics || new Set()
        if (reason === Puber.CloseReason.Node) {
            remSuberPubers(puber.chain, SuberTyp.Kv, puber.kvSubId!, puber.id)
        } else if (reason === Puber.CloseReason.Kv) {
            remSuberPubers(puber.chain, SuberTyp.Node, puber.subId!, puber.id)
        } else {
            remSuberPubers(puber.chain, SuberTyp.Kv, puber.kvSubId!, puber.id)
            remSuberPubers(puber.chain, SuberTyp.Node, puber.subId!, puber.id)
        }

        if (ptopics.size < 1) {
            // delete puber
            // NOTE: subscribe may not response yet
            Puber.G.del(puber.id)
            log.info(`handle puber ${puber.id} close done: no subscribe topic`)
            return
        }
        // clear puber when unscribe done
        puber.event = new EventEmitter()
        Puber.G.updateOrAdd(puber)

        puber.event.on('done', () => {
            Puber.G.del(puber.id)
            log.info(`clear subercribe context of puber[${puber.id}] close done`)
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
            Suber.unsubscribe(chain, req.subType, req.subId, topic.method, subsId)
            log.info(`unsubscribe topic[${topic.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${req.subId}] ${req.subType}`)
        }
        log.info(`handle puber close done: unsubscribe all topic`)
    }

    export const unRegist = async (pubId: IDT, reason: Puber.CloseReason): PVoidT => {
        /// when puber error or close,
        /// if suber close or error, will emit puber close

        let re: Option<any> = Puber.G.get(pubId)
        if (isNone(re) || !re.value.subId) {
            // SBH
            log.error(`[SBH] Unregist puber error: invalid puber ${pubId}`)
            process.exit(1)
        }
        const puber = re.value as Puber

        GG.decrConnCnt(puber.chain, puber.pid)

        clearSubscribeContext(puber, reason)
    }

    export const isSubscribed = (chain: string, pid: IDT, data: WsData): boolean => {
        const topics = GG.getSubTopics(chain, pid)
        log.info(`subscribed topics of chain[${chain}] pid[${pid}]: `, Object.keys(topics))
        for (let id in topics) {
            log.debug(`id: ${id}\n data: ${JSON.stringify(data)}, topic: ${JSON.stringify(topics[id])}`)
            const sub = topics[id]
            const sMthod = sub.method === data.method
            const sParams = md5(JSON.stringify(sub.params)) === md5(JSON.stringify(data.params))
            log.debug(`params pair: ${data.params}--${sub.params}, ${sMthod} ${sParams}`)
            if (sMthod && sParams) {
                return true
            }
        }
        return false
    }

    export const init = async () => {
        Suber.init()
    }
}

export default Matcher