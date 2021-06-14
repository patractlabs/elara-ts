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
    } else {
        suber = re.value as Suber
    }

    const reqId = Matcher.newRequest(pubId, data)
    log.info('Send new message to suber, request ID: ', reqId)
    data.id = reqId   // id bind
    suber.ws.send(JSON.stringify(data)) 
}


const isSubed = (chain: string, pid: IDT, data: WsData): boolean => {
    const topics = G.getSubTopics(chain, pid)
    log.info(`topic subescribed of chain[${chain}] project[${pid}]: `, topics)
    for (let id in topics) {
        log.info('topic sub ID: ', id)
        const sub = topics[id]
        const params = JSON.stringify(data.params) || 'none'
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

    export const updateTopics = (pubId: IDT, subsId: string): void => {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            // SBH
            log.error(`update puber topics error: ${re.value}`)
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
        log.warn('Max connection limit: ', wsConf.maxConn, curConn)
        if (curConn >= wsConf.maxConn) {
            ws.send('Out of connection limit')
            ws.terminate()
            return Err('Out of connectino limit')
        }
    
        const puber = create(ws, chain, pid)

        // regist in Matcher
        let re = await Matcher.regist(puber)

        if (isErr(re)) {
            const err = `Matcher regist error: ${re.value}`
            return Err(err)
        }

        log.info(`Create puber successfully [${puber.id}]-[${puber.subId}]`)
        return Ok(puber)
    }

    export const onMessage = async (puber: Puber, data: WebSocket.Data): PVoidT => {
        let dat: WsData
        const pubId = puber.id
        const chain = puber.chain
        try {
            dat = JSON.parse(data.toString()) as WsData
        } catch (err) {
            log.error('Parse message to JSON error: ', err)  
            puber.ws.send('Invalid request, must be {"id": number, "jsonrpc": "2.0", "method": "your method", "params": []}')
            return
        }
        log.info('Into message handler: ', dat)
    
        // topic bind to chain and params 
        if (isSubed(chain, puber.pid, dat)){
            log.warn(`The topic [${dat.method}] has been subscribed,no need to subscribe twice!`)
            puber.ws.send('No need to subscribe twice')
            return
        }
    
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