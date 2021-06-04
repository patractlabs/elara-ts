/// 1. manage the topic has been subscribed
/// 2. create Puber and regist in Matcher
/// 3. proxy request
/// 4. clear puber matcher when error or close

import WebSocket from 'ws'
import Http from 'http'
import { randomId } from 'lib/utils'
import { MatcherT, Puber, Suber, SubscripT, WsData } from './interface'
import G from './global'
import { getAppLogger, IDT, Option, Some, None, isNone, PResultT, Err, Ok, isErr, PVoidT, ResultT } from 'lib'
import Matcher from './matcher'
import Topic from './topic'

const log = getAppLogger('Puber', true)

const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true })

// /chain/pid
const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()

type ChainPidT = {
    chain: string,
    pid: IDT
}

const urlParse = (url: string): Option<ChainPidT> => {
    if (UrlReg.test(url)) {
        const parse = UrlReg.exec(url)
        return Some({
            chain: parse![1].toLowerCase(),
            pid: parse![2]
        })
    }
    log.error('Invalid url path: ', url)
    return None
}

const puberClear = (pubId: IDT) => {
    G.delPuber(pubId)
    const re = Matcher.get(pubId)
    if (isErr(re)) {
        log.error('get matcher error: ', re.value)
    } else {
        const mat = re.value as MatcherT
        const chain = mat.chain!
        const pid = mat.pid!
        const subId = mat.subId!
        
        const topics = G.getSubTopics(mat.chain!, mat.pid!)
        log.info(`topics of chain[${mat.chain}] pid[${mat.pid}]`, topics)
        for (let id of mat.subscribe || []) {
            log.info('subscribe id: ', id)
            const subscript = topics[id] as SubscripT
            const subsId = subscript.id!
            log.info('subscription: ', subscript)
            if (subscript.topic) {
                suberUnsubscribe(chain, subId, subscript.topic, subsId)
                G.delSubscription(subsId)
                G.remSubTopic(chain, pid, subsId)
            }
        }
    }
    Matcher.unRegist(pubId)
}

Server.on('upgrade', async (res, socket, head) => {
    const path = res.url
    const re: any = urlParse(path)
    if (isNone(re)) {
        log.error('Invalid socket request: ', path)
        return
    }
 
    // only handle urlReg pattern request
    wss.handleUpgrade(res, socket, head, (ws, req: any) => {
        log.info('Handle upgrade event')
        req['chain'] = re.value.chain
        req['pid'] = re.value.pid
        wss.emit('connection', ws, req)
    })
})

wss.on('connection', async (ws, req: any) => {

    log.info(`New socket connection CHAIN[${req.chian}] PID[${req.pid}]`, req.chain, req.pid)
    // 
    let re = await connectHandler(ws, req.chain, req.pid)
    if (isErr(re)) {
        log.error('Connect handle error: ', re.value)
        ws.terminate()
        return
    }
    const puber = re.value as Puber
    ws.on('message', (data) => {
        log.info('New msg-evt: ', data)
        msgHandler(puber, data)
    })
 
    ws.on('close', (code, reason) => {
        log.error('Connection closed: ', code, reason)
        puberClear(puber.id)
    })

    ws.on('error', (err) => {
        log.error('Connection error: ', err)
        ws.terminate()
        puberClear(puber.id)
    })
    return
})

const newPuber = (ws: WebSocket, chain: string, pid: IDT): Puber => {
    return { id: randomId(), pid, chain, ws }
}

const connectHandler = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {

    // connection limit
    // TODO: according to pid connection config 
    const isLimit = false
    if (isLimit) {
        ws.send('Out of connection limit')
        ws.terminate()
        return Err('Out of connectino limit')
    }

    const puber = newPuber(ws, chain, pid)
    G.addPuber(puber)
    log.warn('New puber: ', G.getPubers())

    // regist matcher, Suber has to be pre-allocated
    const re = Matcher.regist(puber.id, chain, pid)
    if (isErr(re)) {
        log.error('Regist matcher error: ', re.value)
        puber.ws.send('Check your chain and pid!')
        puber.ws.terminate()
        G.delPuber(puber.id)
        return Err('Matcher regist failed')
    }
    const subId = re.value as IDT
    log.info(`Regist matcher [${puber.id}]-[${subId}]`)
    return Ok(puber)
}

const getSuber = (pubId: IDT, chain: string): ResultT => {
    let re: any = G.getSubId(pubId)
    const subId = re.value as IDT
    if (isErr(re)) {
        return Err(`No suber id matched`)
    }
    re = G.getSuber(chain, re.value)
    if (isErr(re)) {
        return Err(`No valid suber of chain[${chain}]-subID[${subId}]`)
    }
    return Ok(re.value as Suber)
}

const suberSend = (pubId: IDT, chain: string, data: WsData): void => {
    const re = getSuber(pubId, chain)
    if (isErr(re)) {
        log.error('Get suber error: ', re.value)
        // TODO 
        // clear puber & Matcher
        return 
    }
    // subscribe method
    if (Topic.subscribe.indexOf(data.method!) !== -1) {
        // handle in suber msg listener
        const params = JSON.stringify(data.params) || 'none'
        G.addMethodCache(pubId, data.method!, params)
    }

    // unsubscribe method
    if (Topic.unsubscribe.indexOf(data.method!) !== -1) {
        // clear SubedTopics, Matcher.subscribe, subscription
        log.info('data params: ', data.params, data.params[0])
        const subsId = data.params[0]
        G.delSubscription(subsId)
        let re = Matcher.get(pubId)
        if (isErr(re)) {
            // SBH
            log.error('get matcher error: ', re.value)
        } else {
            const mat = re.value as MatcherT
            G.remSubTopic(chain, mat.pid!, subsId)
            Matcher.remSubscribe(pubId, subsId)
        }
    }

    const suber = re.value as Suber
    Matcher.update(pubId, {originId: data.id})
    log.warn('matcher: ', Matcher.get(pubId))
    data.id = pubId   // id bind
    suber.ws.send(JSON.stringify(data)) 
}

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

const isSubed = (chain: string, pid: IDT, data: WsData): boolean => {
    const topics = G.getSubTopics(chain, pid)
    log.info('topic of chain project: ', topics)
    for (let id in topics) {
        log.info('topic sub ID: ', id)
        const sub = topics[id]
        const params = JSON.stringify(data.params) || 'none'
        if (sub.topic === data.method && sub.params === params) {
            return true
        }
    }
    return false
}

const isUnsub = (): boolean => {
    return false
}

const msgHandler = async (puber: Puber, data: WebSocket.Data): PVoidT => {
    let dat: WsData
    const pubId = puber.id
    const chain = puber.chain
    try {
        dat = JSON.parse(data.toString()) as WsData
    } catch (err) {
        log.error('Parse message to JSON error: ', err)  
        puber.ws.send('Invalid request')
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

namespace Puber {
    export const init = () => {
        Server.listen(7001, () => {
            log.info('Node direct server start on: 7001')
        })
    }
}

export default Puber