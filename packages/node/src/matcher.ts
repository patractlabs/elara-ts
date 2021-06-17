/// manager ws socket pair 
/// TODO
/// 1. dapps fail
///     - part connectin fail, regist matcher to valid connection
///     - all fail, clear all matcher bind to this dapp

/// 2. elara fail
///     - all connection fail, need dapps to reconnect
/// 3. node fail
///     - node recover in soon(e.g. 10s), keep the puber connection, regist matchers
///     - node fail longtime, clear all pubers and matchers


/// TODO:
/// 1. node fail handle logic 
/// 2. rpc logic  
/// 3. chain config update handle logic


import { IDT, getAppLogger, Err, Ok, ResultT, PResultT, isErr, isOk } from 'lib'
import G from './global'
import { WsData, SubscripT, ReqT } from './interface'
import Puber from './puber'
import Suber from './suber'
import Topic from './topic'
import { randomId } from 'lib/utils'
// import Assert from 'assert'
import Util from './util'

const log = getAppLogger('matcher', true)

const suberUnsubscribe = (chain: string, subId: IDT, topic: string, subsId: string) => {
    log.warn('Into unsubcribe: ', chain, subId, topic, subsId)
    const re = G.getSuber(chain, subId)
    if (isErr(re)) {
        log.error('get suber to unsubcribe error: ', re.value)
        return
    }
    const suber = re.value as Suber
    const unsub = {
        id: 1,
        jsonrpc: '2.0',
        method: Topic.getUnsub(topic),
        params: [subsId]
    }
    suber.ws.send(Util.reqFastStr(unsub))
}

const clearSubContext = (puber: Puber) => {
    // sub context: 1. subed topics 2. subreqMap 3. reqCache for subscribe
    log.warn(`Into clear puber [${puber.id}] subscription context: `, puber.chain, puber.pid)
    const chain = puber.chain
    const pid = puber.pid
    const subId = puber.subId!
    
    const topics = G.getSubTopics(chain, pid)
    log.warn(`topics of chain[${chain}] pid[${pid}] to unsubscribe`, topics)
    for (let subsId of puber.topics || []) {
        log.info('subscribe id: ', subsId)
        const subscript = topics[subsId] as SubscripT
        log.info('subscription: ', subscript)
        if (subscript.method) {
            suberUnsubscribe(chain, subId, subscript.method, subsId)
        }
        let re = G.getReqId(subsId)
        if (isOk(re)) {
            G.delReqCache(re.value)
        }
        G.delSubReqMap(subsId)
        G.remSubTopic(chain, pid, subsId)
    }
}

const isSubReq = (method: string): boolean => {
    return Topic.subscribe.indexOf(method) !== -1
}

const isUnsubReq = (method: string): boolean => {
    return Topic.unsubscribe.indexOf(method) !== -1
}

const unsubRequest = (pubId: IDT, data: WsData) => {
    log.info(`Puber[${pubId}] unsubcribe ${data.method}: `, data.params[0])
    const subsId = data.params[0]
    if (!subsId) {
        log.error('Invalid unsubscribe params: ', subsId)
        return
    }

    // update puber topics
    let re = G.getPuber(pubId)
    if (isErr(re)) {
        log.error(`unsubscribe request error: `, re.value)
        return
    }
    const puber = re.value as Puber
    puber.topics!.delete(subsId)
    G.updateAddPuber(puber)

    // update SubedTopics
    G.remSubTopic(puber.chain, puber.pid, subsId)

    // delet reqCache of subscribe
    re = G.getReqId(subsId)
    if (isOk(re)) {
        G.delReqCache(re.value)
    }

    // update SubReqMap
    G.delSubReqMap(subsId)
}

namespace Matcher {
    export const regist = async (puber: Puber): PResultT => {
        /// when puber connect
        
        const chain = puber.chain
        const re = await Suber.selectSuber(chain)
        if (isErr(re)) {
            return re
        }
        const suber = re.value as Suber

        // update suber.pubers
        suber.pubers = suber.pubers || new Set<IDT>()
        suber.pubers.add(puber.id)
        G.updateAddSuber(chain, suber)

        // update puber.subId
        puber.subId = suber.id
        G.updateAddPuber(puber)

        // side context set
        G.incrConnCnt(chain, puber.pid)
        return Ok(true)
    }

    export const unRegist = async (pubId: IDT): PResultT => {
        /// when puber error or close,
        /// if suber close or error, will emit puber close
        
        let re = G.getPuber(pubId)
        if (isErr(re) || !re.value.subId) {
            // SBH
            log.error('[SBH] Unregist puber error: ', re.value)
            return Err(`unregist puber error: ${re.value}`)
        }
        const puber = re.value as Puber

        G.decrConnCnt(puber.chain, puber.pid)   
        clearSubContext(puber) 
        G.delPuber(pubId)

        re = G.getSuber(puber.chain, puber.subId!)
        if (isErr(re)) {
            log.error('Unregist puber error: ', re.value)
            return Err(`unregist puber error: ${re.value}`)
        }
        const suber = re.value as Suber

        if (!suber.pubers || suber.pubers.size < 1) {
            log.error('Unregist puber error: empty puber member')
            return Err('unregist puber error: empty puber member')
        }
        suber.pubers.delete(pubId)
        G.updateAddSuber(suber.chain, suber)
        log.info(`Unregist successfully: ${pubId} - ${suber.id}`)
        // Util.logGlobalStat()
        // global.gc()
        return Ok(true)
    }

    export const newRequest = (pubId: IDT, data: WsData): IDT => {
        const method = data.method!
        const req = { 
            id: randomId(), pubId,
            originId: data.id, 
            jsonrpc: data.jsonrpc,
            isSubscribe: isSubReq(method),
            method, 
            params: `${data.params}` || 'none'
        } as ReqT

        G.updateAddReqCache(req)

        // unsubscribe method
        if (isUnsubReq(data.method!)) {
            unsubRequest(pubId, data)
        }
        return req.id
    }

    export const setSubContext =  (req: ReqT, subsId: string): ResultT => {
        // update subscribe request cache
        req.subsId = subsId
        G.updateAddReqCache(req)

        // update puber.topics, 
        let re = G.getPuber(req.pubId)
        if (isErr(re)) {
            // SBH
            // process.exit(1) ?
            return Err(`set subscribe context error: ${re.value}`)
        }
        const puber = re.value as Puber

        // add new subscribed topic
        G.addSubTopic(puber.chain, puber.pid, {id: subsId,pubId: req.pubId, method: req.method, params: req.params})
   
        // if unsubscribe, dont update
        re = G.getReqId(subsId)
        if (isErr(re)) {
            G.addSubReqMap(subsId, req.id)
        }
        return Ok(0)
    }
}

export default Matcher