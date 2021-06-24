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
import { IDT, getAppLogger, Err, Ok, ResultT, PResultT, isErr, PVoidT } from 'lib'
import G from './global'
import { WsData, SubscripT, ReqT } from './interface'
import Puber from './puber'
import Suber from './suber'
import { randomId } from 'lib/utils'
import Util from './util'
import Conf from '../config'
import Topic from './topic'

const log = getAppLogger('matcher', true)

const clearSubContext = async (puber: Puber) => {
    // sub context: 1. subed topics 2. subreqMap 3. reqCache for subscribe
    // topic context which subscribed should be clear after unsubscribe response true
    // then clear the puber when all topic context clear
    const {chain, pid, subId} = puber
    const topics = G.getSubTopics(chain, pid)
    log.info(`clear subscribe context chain[${chain}] pid[${pid}] topics: `, Object.keys(topics))
    const ptopics = puber.topics || new Set()
    const hasTopic = ptopics.size > 0
    if (!hasTopic) {
        // clear request cache
        const reqs = G.getAllReqCache()
        for (let reqId in reqs) {
            let req = reqs[reqId]
            if (req.pubId === puber.id) {
                G.delReqCache(reqId)
                log.warn(`clear request cache [${reqId}] of puber[${puber.id}]`)
            }
        }

        G.delPuber(puber.id)
        log.info(`puber[${puber.id}] has no topics, clear done`)
        return
    }
    // regist event
    puber.event = new EventEmitter()
    G.updateAddPuber(puber)

    // clear event
    puber.event.on('done', () => {
        G.delPuber(puber.id)
        log.info(`clear subercribe context of puber[${puber.id}] done`)
    })
    for (let subsId of puber.topics || new Set()) {
        const subscript = topics[subsId] as SubscripT
        Suber.unsubscribe(chain, subId!, subscript.method, subsId)
        // clearSubCache(chain, pid, subsId)
        log.info(`unsubescribe topic[${subscript.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${subId}]`)
    }
}

const connLimit = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {
    const wsConf = Conf.getWs()
    const curConn = G.getConnCnt(chain, pid)
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
    export const regist = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {
        let re: ResultT = await connLimit(ws, chain, pid)
        if (isErr(re)) { return re }
        
        re = await Suber.selectSuber(chain)
        if (isErr(re)) { return re }
        const suber = re.value as Suber

        // create new puber 
        const puber = Puber.create(ws, chain, pid)

        // update suber.pubers
        suber.pubers = suber.pubers || new Set<IDT>()
        suber.pubers.add(puber.id)
        G.updateAddSuber(chain, suber)

        // update puber.subId
        puber.subId = suber.id
        G.updateAddPuber(puber)

        // side context set
        G.incrConnCnt(chain, puber.pid)
        log.info(`regist puber[${puber.id}] to suber[${suber.id}]: `, Util.globalStat())
        return Ok(puber)
    }
    
    export const newRequest = (chain: string, pid: IDT, pubId: IDT, data: WsData): ResultT => {
        const method = data.method!
        // TODO: subscribe & unsubscribe method to pre handle
        if (isUnsubReq(method)) {
            log.info(`pre handle unsubscribe request: ${method}: `, data.params, Suber.isSubscrieID(data.params[0]))
            if (data.params.length < 1 || !Suber.isSubscrieID(data.params[0])) {
                return Err(`invalid unsubscribe params: ${data.params[0]}`)
            }
        }

        const isSubscribe = isSubReq(method)
        const req = { 
            id: randomId(), pubId,
            chain,
            pid,
            originId: data.id, 
            jsonrpc: data.jsonrpc,
            isSubscribe, 
            method, 
            params: `${data.params}` || 'none'
        } as ReqT

        G.updateAddReqCache(req)

        data.id = req.id
        log.info(`global stat after new request[${req.id}] : `, Util.globalStat())
        return Ok(data)
    }

    // according to message set the subscribe context
    export const setSubContext = (req: ReqT, subsId: string): ResultT => {
        // update subscribe request cache
        req.subsId = subsId
        G.updateAddReqCache(req)

        // update submap
        G.addSubReqMap(subsId, req.id)

        // update puber.topics
        let re = Puber.updateTopics(req.pubId, subsId)
        if (isErr(re)) {
            return Err(`parase data error: ${re.value}`)
        }
        const puber = re.value as Puber

        // add new subscribed topic
        G.addSubTopic(puber.chain, puber.pid, {id: subsId, pubId: req.pubId, method: req.method, params: req.params})
   
        log.info(`After set subscribe context requestId[${req.id}] global stat: `, Util.globalStat())    // for test
        return Ok(0)
    }

    export const unRegist = async (pubId: IDT): PVoidT => {
        /// when puber error or close,
        /// if suber close or error, will emit puber close
        
        let re = G.getPuber(pubId)
        if (isErr(re) || !re.value.subId) {
            // SBH
            log.error('[SBH] Unregist puber error: ', re.value)
            process.exit(1)
            // return Err(`unregist puber error: ${re.value}`)
        }
        const puber = re.value as Puber

        G.decrConnCnt(puber.chain, puber.pid)   
        clearSubContext(puber) 

        re = G.getSuber(puber.chain, puber.subId!)
        if (isErr(re)) {
            log.error('Unregist puber error: ', re.value)
            return
        }
        const suber = re.value as Suber

        if (!suber.pubers || suber.pubers.size < 1) {
            log.error('Unregist puber error: empty puber member')
            process.exit(1)
        }
        suber.pubers.delete(pubId)
        G.updateAddSuber(suber.chain, suber)
        log.info(`Unregist successfully: ${pubId} - ${suber.id}, global stat: `, Util.globalStat())
        // global.gc()
    }

    export const getSuber = (chain: string, pubId: IDT): ResultT => {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            return re
        }
        const puber = re.value as Puber
        re = G.getSuber(chain, puber.subId!)
        if (isErr(re)) {
            return Err(`No valid suber of chain[${chain}]-subID[${puber.subId}]`)
        }
        return Ok(re.value as Suber)
    }

    
    export const isSubscribed = (chain: string, pid: IDT, data: WsData): boolean => {
        const topics = G.getSubTopics(chain, pid)
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
}

export default Matcher