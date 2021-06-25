/// 1. manage the topic has been subscribed
/// 2. create Puber and regist in Matcher
/// 3. proxy request
/// 4. clear puber matcher when error or close

import WebSocket from 'ws'
import { randomId } from 'lib/utils'
import { WsData } from './interface'
import G from './global'
import { getAppLogger, IDT, PResultT, Err, Ok, isErr, PVoidT, ResultT } from 'lib'
import Matcher from './matcher'
import Suber from './suber'
import Conf from '../config'
import Util from './util'

const log = getAppLogger('Puber', true)

const getSuberBypubId = (pubId: IDT, chain: string): ResultT => {
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

const suberSend = async (pubId: IDT, chain: string, data: WsData): PVoidT => {
    const start = Util.traceStart()
    let re = getSuberBypubId(pubId, chain)
    let suber: Suber
    if (isErr(re)) {
        log.error('[SBH] Suber send error: ', re.value)

        // try to realloc suber 
        re = await Suber.selectSuber(chain)
        if (isErr(re)) {
            log.error(`Realloc suber for puber [${pubId}] of chain [${chain}] failed: `, re.value)
            process.exit(1)
        }
        suber = re.value as Suber
        re = G.getPuber(pubId)
        if (isErr(re)) {
            log.error('Re match puber suber error: ', re.value)
            return
        }
        const puber = re.value as Puber
        puber.subId = suber.id
        G.updateAddPuber(puber)
        
        // update suber
        suber.pubers = suber.pubers || new Set()
        suber.pubers.add(puber.id)
        G.updateAddSuber(chain, suber)
        log.info(`Try to realloc new suber success: suber[${suber.id}]`)
    } else {
        suber = re.value as Suber
    }

    const reqId = Matcher.newRequest(pubId, data)
    data.id = reqId   // id bind
    suber.ws.send(Util.reqFastStr(data)) 
    const time = Util.traceEnd(start)
    log.info(`Send new message to suber[${suber.id}] of chain ${chain}, request ID: ${reqId} time[${time}]`)
}


const isSubed = (chain: string, pid: IDT, data: WsData): boolean => {
    // method and params specify a subscribe topic
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

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    subId?: IDT,            // suber id
    topics?: Set<string>    // {subscribeId}
}


namespace Puber {

    export const create = (ws: WebSocket, chain: string, pid: IDT): Puber => {
        const puber = { id: randomId(), pid, chain, ws } as Puber
        G.updateAddPuber(puber)
        return puber
    }

    export const updateTopics = async (pubId: IDT, subsId: string): PVoidT => {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            // SBH
            log.error(`update puber[${pubId}] topics error: ${re.value}`)
            process.exit(1) // exit process or ?
        }
        const puber = re.value as Puber
        puber.topics = puber.topics || new Set<string>()
        puber.topics.add(subsId)
        G.updateAddPuber(puber)
    }

    export const onConnect = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {

        // connection limit 
        const wsConf = Conf.getWs()
        const curConn = G.getConnCnt(chain, pid)
        log.info(`current ws connection of chain ${chain} pid[${pid}]: ${curConn}/${wsConf.maxConn}`)
        if (curConn >= wsConf.maxConn) {
            ws.send('Out of connection limit')
            ws.terminate()
            return Err('Out of connectino limit')
        }

        const puber = create(ws, chain, pid)

        // regist in Matcher
        const start = Util.traceStart()
        let re = await Matcher.regist(puber)
        const time = Util.traceEnd(start)
        log.info(`matche register puber[${puber.id}] time: ${time}`)
        if (isErr(re)) {
            const err = `Matcher regist error: ${re.value}`
            return Err(err)
        }

        log.info(`puber[${puber.id}] of pid[${pid}] connect to chain ${chain} successfully`)
        return Ok(puber)
    }

    export const onMessage = async (puber: Puber, data: WebSocket.Data): PVoidT => {
        let dat: WsData
        const start = Util.traceStart()
        const pubId = puber.id
        const chain = puber.chain
        log.info(`new puber[${puber.id}] request of chain ${puber.chain}: `, data)
        try {
            dat = JSON.parse(data.toString()) as WsData
        } catch (err) {
            log.error('Parse message to JSON error')  
            return puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
        }
    
        // topic bind to chain and params 
        if (isSubed(chain, puber.pid, dat)){
            log.warn(`The topic [${dat.method}] has been subscribed, no need to subscribe twice!`)
            return puber.ws.send('No need to subscribe twice')
        }
        const time = Util.traceEnd(start)
        log.info(`on puber socket message time[${time}]`)
        // transmit requset & record subscription topic
        suberSend(pubId, chain, dat)
    }

    export const clear = async (pubId: IDT): PVoidT => {
        // unsbscribe topics
        // 
        Matcher.unRegist(pubId)
    }
}

export default Puber