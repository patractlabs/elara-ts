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
import { IDT, getAppLogger, Err, Ok, ResultT, PResultT, isErr, PVoidT, isNone, Option } from 'lib'
import GG from '../global'
import { WsData, SubscripT, ReqT, ReqTyp, ReqDataT } from '../interface'
import Puber from '../puber'
import Suber, { SuberTyp } from './suber'
import { randomId } from 'lib/utils'
import Util from '../util'
import Conf from '../../config'
import Topic from './topic'

const log = getAppLogger('matcher', true)

const connLimit = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {
    const wsConf = Conf.getWsPool()
    const curConn = GG.getConnCnt(chain, pid)
    log.info(`current ws connection of chain ${chain} pid[${pid}]: ${curConn}/${wsConf.maxConn}`)
    if (curConn >= wsConf.maxConn) {
        ws.close(1002, 'Out of connection limit')
        return Err('Out of connectino limit')
    }
    return Ok(0)
}

const isSubReq = (method: string): boolean => {
    return Topic.subscribe.indexOf(method) !== -1
}

const isUnsubReq = (method: string): boolean => {
    return Topic.unsubscribe.indexOf(method) !== -1
}

namespace Matcher {
    export const Rpcs = [
        "chain_subscribeAllHeads",          // chain_allHead
        "chain_subscribeFinalisedHeads",    // chain_finalizedHead
        "chain_subscribeFinalizedHeads",    // chain_finalizedHead
        "chain_subscribeNewHead",           // chain_newHead
        "chain_subscribeNewHeads",          // chain_newHead
        "chain_subscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_subscribeJustifications",  // grandpa_justifications

        "state_subscribeRuntimeVersion",    // state_runtimeVersion
        "state_subscribeStorage",           // state_storage
        "author_submitAndWatchExtrinsic",   // author_extrinsicUpdate
    
        "subscribe_newHead"                 // chain_newHead
    ]

    export const regist = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {
        let re: ResultT = await connLimit(ws, chain, pid)
        if (isErr(re)) { return re }
        
        re = await Suber.selectSuber(chain, SuberTyp.Node)
        if (isErr(re)) { return re }
        const suber = re.value as Suber

        re = await Suber.selectSuber(chain, SuberTyp.Kv)
        if (isErr(re)) { return re }
        const kvSuber = re.value as Suber

        // create new puber 
        const puber = Puber.create(ws, chain, pid)

        // update suber.pubers
        suber.pubers = suber.pubers || new Set<IDT>()
        suber.pubers.add(puber.id)
        Suber.G.updateOrAdd(chain, SuberTyp.Node, suber)

        kvSuber.pubers = suber.pubers || new Set<IDT>()
        kvSuber.pubers.add(puber.id)
        Suber.G.updateOrAdd(chain, SuberTyp.Kv, suber)

        // update puber.subId
        puber.subId = suber.id
        puber.kvSubId = kvSuber.id
        Puber.G.updateOrAdd(puber)

        // side context set
        GG.incrConnCnt(chain, puber.pid)
        log.info(`regist puber[${puber.id}] to suber[${suber.id}]: `, Util.globalStat())
        return Ok(puber)
    }
    
    export const newRequest = (chain: string, pid: IDT, pubId: IDT, subType: SuberTyp, subId: IDT, data: ReqDataT): ResultT => {
        const method = data.method!
        let type = ReqTyp.Rpc
        
        if (isUnsubReq(method)) {
            log.info(`pre handle unsubscribe request: ${method}: `, data.params, Suber.isSubscribeID(data.params[0]))
            type = ReqTyp.Unsub
            if (data.params.length < 1 || !Suber.isSubscribeID(data.params[0])) {
                return Err(`invalid unsubscribe params: ${data.params[0]}`)
            }
        } else if(isSubReq(method)) {
            type = ReqTyp.Sub
        }
        const req = { 
            id: randomId(), 
            pubId,
            chain,
            pid,
            subType: subType,
            subId,
            originId: data.id, 
            jsonrpc: data.jsonrpc,
            type, 
            method, 
            params: `${data.params}`
        } as ReqT

        GG.addReqCache(req)

        data.id = req.id as string
        log.info(`global stat after new request[${req.id}] : `, Util.globalStat())
        return Ok(data)
    }

    // according to message set the subscribe context
    export const setSubContext = (req: ReqT, subsId: string): ResultT => {
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
        GG.addSubTopic(puber.chain, puber.pid, {id: subsId, pubId: req.pubId, method: req.method, params: req.params})
   
        log.info(`After set subscribe context requestId[${req.id}] global stat: `, Util.globalStat())    // for test
        return Ok(0)
    }

    const isSuberClosed = (reason: Puber.CloseReason):boolean => {
        return reason === Puber.CloseReason.Kv || reason === Puber.CloseReason.Node
    }

    const clearReqCacheByPuber = (pubId: IDT) => {
        // TODO: by puber
        const reqs = GG.getAllReqCache()
        for (let reqId in reqs) {
            if (reqs[reqId].pubId === pubId) {
                GG.delReqCache(reqId)
            }
        }
    }

    const handlePuberClose = (puber: Puber) => {
        const ptopics = puber.topics || new Set()
        if (ptopics.size < 1) {
            let re = Suber.G.get(puber.chain, SuberTyp.Node, puber.subId!)
            if (isNone(re)) {
                log.error(`handle puber close error: invalid ${puber.chain} suber ${puber.subId} type ${SuberTyp.Node}`)
                process.exit(2)
            }
            const suber = re.value as Suber
            suber.pubers?.delete(puber.id)
            re = Suber.G.get(puber.chain, SuberTyp.Kv, puber.kvSubId!)
            if (isNone(re)) {
                log.error(`handle puber close error: invalid ${puber.chain} suber ${puber.kvSubId} type ${SuberTyp.Kv}`)
                process.exit(2)
            }
            const kvSuber = re.value as Suber
            kvSuber.pubers?.delete(puber.id)
            
            // delete puber
            Puber.G.del(puber.id)
            return
        }
        // clear puber when unscribe done
        puber.event = new EventEmitter()
        Puber.G.updateOrAdd(puber)

        puber.event.on('done', () => {
            Puber.G.del(puber.id)
            log.info(`clear subercribe context of puber[${puber.id}] done`)
        })
        const { chain, pid } = puber
        for (let subsId of ptopics) {
            let re = GG.getSubTopic(chain, pid, subsId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const topic = re.value as SubscripT
            re = GG.getReqId(subsId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const reqId = re.value as IDT
            re = GG.getReqCache(reqId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const req = re.value as ReqT
            Suber.unsubscribe(chain, req.subType, req.subId, topic.method, subsId)
            log.info(`unsubscribe topic[${topic.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${req.subId}] ${req.subType}`)
        }
    }

    const handleSuberClose = (puber: Puber, subType: SuberTyp) => {
        /// clear both kv&node suber, alive suber.ws close
        // no topic: clear reqcache, clear puber
        // TODO: if kv unavailable, transpond request to node
        //       if node unavailable, keep the kv service
        // current version we dont close suber!!! And keep the try connection.
        log.info(`${subType} suber of chain ${puber.chain} closed, puber ${puber.id}`)
        const { chain, pid } = puber
        const ptopics = puber.topics || new Set()
        if (ptopics.size < 1) {
            // clear request cache relate to puber
            clearReqCacheByPuber(puber.id)
            let st
            let id
            if (subType === SuberTyp.Node) {
                st = SuberTyp.Kv
                id = puber.kvSubId
            } else {
                st = SuberTyp.Node
                id = puber.subId
            }
            let re = Suber.G.get(chain, st, id!)
            if (isNone(re)) {
                log.error(`handle puber close error: invalid suber ${id} chain ${chain} type ${st}`)
                process.exit(2)
            }
            const suber = re.value as Suber
            suber.ws.close()    // NOTE:dup trigger close
            Suber.G.del(puber.chain, SuberTyp.Node, puber.subId!)
            Suber.G.del(puber.chain, SuberTyp.Kv, puber.kvSubId!)
            Puber.G.del(puber.id)
            return
        }
        // has topic: unsubscribe topic that bind to another alive suber service, and 
        //  ignore the closed suber's topics.
        // clear suber, celar puber, clear sub cache, clear reqCache
        // NOTE: the closed suber may has some reqcache wont be clear
        for (let subsId of ptopics) {
            let re = GG.getSubTopic(chain, pid, subsId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const topic = re.value as SubscripT
            let hasUnsub = true
            re = GG.getReqId(subsId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const reqId = re.value as IDT
            re = GG.getReqCache(reqId)
            if (isErr(re)) {
                log.error(`unsubscribe when puber clsoe error: ${re.value}`)
                process.exit(2)
            }
            const req = re.value as ReqT
            // clear dead suber subscribe context
            if (req.subType === subType) {
                GG.remSubTopic(chain, pid, subsId)
                GG.delSubReqMap(subsId)
                GG.delReqCache(reqId)
            } else {
                // unsubscribe
                if (hasUnsub) {
                    hasUnsub = false
                    puber.event = new EventEmitter()
                    Puber.G.updateOrAdd(puber)
                    puber.event.on('done', () => {
                        clearReqCacheByPuber(puber.id)  // make sure the closed suber no-sub req cache be clear
                        Puber.G.del(puber.id)
                        log.info(`clear subercribe context of puber[${puber.id}] done`)
                    })
                }
                Suber.unsubscribe(chain, req.subType, req.subId, topic.method, subsId)
                log.info(`unsubscribe topic[${topic.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${req.subId}] ${req.subType}`)
            }
        }
        // clear suber
        Suber.G.del(chain, SuberTyp.Node, puber.subId!)
        Suber.G.del(chain, SuberTyp.Kv, puber.kvSubId!)
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

        // puber close: 1. has topics 2. no topics
        // suber close: 1. has topics 2. no topics
        if (isSuberClosed(reason)) {
            log.error(`[SBH] something wrong!`)
            let subType = (reason === Puber.CloseReason.Node) ? SuberTyp.Node : SuberTyp.Kv
            handleSuberClose(puber, subType)
        } else {
            handlePuberClose(puber)
        }
    }
    
    export const isSubscribed = (chain: string, pid: IDT, data: WsData): boolean => {
        const topics = GG.getSubTopics(chain, pid)
        log.info(`subscribed topics of chain[${chain}] pid[${pid}]: `, Object.keys(topics))
        for (let id in topics) {
            const sub = topics[id]
            const params = `${data.params}` || 'none'
            if (sub.method === data.method && sub.params === params) {
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