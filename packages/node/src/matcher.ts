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


import { IDT, getAppLogger, Err, Ok, ResultT, isErr } from 'lib'
import G from './global'
import { WsData, SubscripT, ReqT } from './interface'
import Puber from './puber'
import Suber from './suber'
import Util from './util'
import Topic from './topic'
import { randomId } from 'lib/utils'

const log = getAppLogger('matcher', true)

const suberUnsubscribe = (chain: string, subId: IDT, topic: string, subsId: string) => {
    log.warn('Into unscribe: ', chain, subId, topic, subsId)
    const re = G.getSuber(chain, subId)
    if (isErr(re)) {
        log.error('get suber to unscribe error: ', re.value)
        return
    }
    const suber = re.value as Suber
    const unsub = {
        id: 1,
        jsonrpc: '2.0',
        method: Topic.getUnsub(topic),
        params: [subsId]
    }
    suber.ws.send(JSON.stringify(unsub))
}

const clearSubContext = (puber: Puber) => {
    const chain = puber.chain
    const pid = puber.pid
    const subId = puber.subId!
    
    const topics = G.getSubTopics(chain, pid)
    log.info(`topics of chain[${chain}] pid[${pid}]`, topics)
    for (let id of puber.topics || []) {
        log.info('subscribe id: ', id)
        const subscript = topics[id] as SubscripT
        log.info('subscription: ', subscript)
        if (subscript.method) {
            suberUnsubscribe(chain, subId, subscript.method, id)
            G.delSubReqMap(id)
            G.remSubTopic(chain, pid, id)
        }
    }
}

const isSubReq = (method: string): boolean => {
    return Topic.subscribe.indexOf(method) !== -1
}

const isUnsubReq = (method: string): boolean => {
    return Topic.unsubscribe.indexOf(method) !== -1
}

const unsubRequest = (pubId: IDT, data: WsData) => {
    // update SubReqMap
    log.info(`Puber[${pubId}] unscribe ${data.method}: `, data.params[0])
    const subsId = data.params[0]
    G.delSubReqMap(subsId)

    // update puber topics
    let re = G.getPuber(pubId)
    if (isErr(re)) {
        log.error(`unsubscribe request error: `, re.value)
        return
    }
    const puber = re.value as Puber
    puber.topics = Util.ldel(puber.topics!, subsId)
    G.addPuber(puber)

    // update SubedTopics
    G.remSubTopic(puber.chain, puber.pid, subsId)

    // clear subscribe SubReqMap{}
    G.delSubReqMap(subsId)
}

namespace Matcher {
    export const regist = (pubId: IDT, suber: Suber): void => {
        const chain = suber.chain
        suber.pubers = suber.pubers || []
        suber.pubers.push(pubId)
        G.updateAddSuber(chain, suber)
    }

    export const unRegist = (pubId: IDT): ResultT => {
        // remove puber.topics and unscribe
        // delete puber
        // remove suber.pubers[pubId]
        let re = G.getPuber(pubId)
        if (isErr(re) || !re.value.subId) {
            // SBH
            log.error('Unregist puber error: ', re.value)
            return Err(`unregist puber error: ${re.value}`)
        }
        const puber = re.value as Puber
        clearSubContext(puber)

        G.delPuber(pubId)

        re = G.getSuber(puber.chain, puber.subId!)
        if (isErr(re)) {
            log.error('Unregist puber error: ', re.value)
            return Err(`unregist puber error: ${re.value}`)
        }
        const suber = re.value as Suber
        if (!suber.pubers || suber.pubers.length < 1) {
            log.error('Unregist puber error: empty puber member')
            return Err('unregist puber error: empty puber member')
        }
        const pubs = Util.ldel(suber.pubers, pubId)
        suber.pubers = pubs
        G.updateAddSuber(suber.chain, suber)
        log.info(`Unregist successfullt: ${pubId} - ${suber.id}`)
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
            params: JSON.stringify(data.params) || 'none'
        } as ReqT

        G.updateAddReqCache(req)

        // unsubscribe method
        if (isUnsubReq(data.method!)) {
            unsubRequest(pubId, data)
        }
        return req.id
    }

    export const setSubContext = (req: ReqT, subsId: string): ResultT => {
        req.subsId = subsId
        G.updateAddReqCache(req)

        // update puber.topics, 
        let re = G.getPuber(req.pubId)
        if (isErr(re)) {
            return Err(`set subscribe context error: ${re.value}`)
        }
        const puber = re.value as Puber
        puber.topics = puber.topics ||[]
        puber.topics.push(subsId)

        // 
        G.addSubTopic(puber.chain, puber.pid, {id: subsId,pubId: req.pubId, method: req.method, params: req.params})
   
        G.addSubReqMap(subsId, req.id)
        return Ok(0)
    }
}

export default Matcher