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
import Suber from './suber'
import { randomId } from 'lib/utils'
import Util from '../util'
import Conf from '../../config'
import Topic from './topic'

const log = getAppLogger('matcher', true)

const clearSubContext = async (puber: Puber, code: number) => {
    // sub context: 1. subed topics 2. subreqMap 3. reqCache for subscribe
    // topic context which subscribed should be clear after unsubscribe response true
    // then clear the puber when all topic context clear
    const {chain, pid, subId} = puber
    const topics = GG.getSubTopics(chain, pid)
    log.info(`clear subscribe context chain[${chain}] pid[${pid}] code[${code}] topics: `, Object.keys(topics))
    const ptopics = puber.topics || new Set()
    const hasTopic = ptopics.size > 0
    if (!hasTopic) {
        // clear request cache
        const reqs = GG.getAllReqCache()
        for (let reqId in reqs) {
            let req = reqs[reqId]
            if (req.pubId === puber.id) {
                GG.delReqCache(reqId)
                log.warn(`clear request cache [${reqId}] of puber[${puber.id}]`)
            }
        }

        Puber.G.del(puber.id)
        log.info(`puber[${puber.id}] has no topics, clear done`)
        return
    }
    if (code === 1000) {
        log.error(`suber has been closed, no need to unsubscribe`)
        // clear subscribe context
        for (let subsId of puber.topics!) {
            let re = GG.getReqId(subsId)
            if (isErr(re)) {
                log.error(`clear subscribe context error: ${re.value}`)
                process.exit(2)
            }
            GG.delReqCache(re.value)
            GG.delSubReqMap(subsId)
            GG.remSubTopic(chain, pid, subsId)
        }
        Puber.G.del(puber.id)
        return
    }
    // regist event
    puber.event = new EventEmitter()
    Puber.G.updateOrAdd(puber)

    // clear event
    puber.event.on('done', () => {
        Puber.G.del(puber.id)
        log.info(`clear subercribe context of puber[${puber.id}] done`)
    })
    for (let subsId of puber.topics || new Set()) {
        const subscript = topics[subsId] as SubscripT
        Suber.unsubscribe(chain, subId!, subscript.method, subsId)
        // clearSubCache(chain, pid, subsId)
        log.info(`unsubscribe topic[${subscript.method}] id[${subsId}] of chain ${chain} pid[${pid}] suber[${subId}]`)
    }
}

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
    export const Rpcs = [""]

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
        Suber.G.updateOrAdd(chain, suber)

        // update puber.subId
        puber.subId = suber.id
        Puber.G.updateOrAdd(puber)

        // side context set
        GG.incrConnCnt(chain, puber.pid)
        log.info(`regist puber[${puber.id}] to suber[${suber.id}]: `, Util.globalStat())
        return Ok(puber)
    }
    
    export const newRequest = (chain: string, pid: IDT, pubId: IDT, subId: IDT, data: ReqDataT): ResultT => {
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

    export const unRegist = async (pubId: IDT, code: number): PVoidT => {
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
        clearSubContext(puber, code) 

        re = Suber.G.get(puber.chain, puber.subId!)
        if (isNone(re)) {
            log.error(`Unregist puber error: invalid suber ${puber.subId} of chain ${puber.chain}`)
            return
        }
        const suber = re.value as Suber

        if (!suber.pubers || suber.pubers.size < 1) {
            log.error('Unregist puber error: empty puber member')
            process.exit(1)
        }
        suber.pubers.delete(pubId)
        Suber.G.updateOrAdd(suber.chain, suber)
        log.info(`Unregist successfully: ${pubId} - ${suber.id}, global stat: `, Util.globalStat())
        // global.gc()
    }

    export const getSuber = (chain: string, pubId: IDT): ResultT => {
        let re: Option<any> = Puber.G.get(pubId)
        if (isNone(re)) {
            return Err(`no puber ${pubId}`)
        }
        const puber = re.value as Puber
        re = Suber.G.get(chain, puber.subId!)
        if (isNone(re)) {
            return Err(`No valid suber of chain[${chain}]-subID[${puber.subId}]`)
        }
        return Ok(re.value as Suber)
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