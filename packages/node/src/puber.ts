/// 1. manage the topic has been subscribed
/// 2. create Puber and regist in Matcher
/// 3. proxy request
/// 4. clear puber matcher when error or close

import WebSocket from 'ws'
import Http from 'http'
import { randomId } from 'lib/utils'
import { Puber, Suber, WsData } from './interface'
import G from './global'
import { getAppLogger, IDT, Option, Some, None, isNone, PResultT, Err, Ok, isErr, PVoidT, ResultT } from 'lib'
import Matcher from './matcher'

const log = getAppLogger('Puber', true)

const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true })

Server.on('upgrade', (req, socket, head) => {
    const path = req.url
    if (path) {
        wss.handleUpgrade(req, socket, head, (ws, req) => {
            log.info('Handle upgrade event')
            wss.emit('connection', ws, req)
        })

    }
})

// /chain/pid
const UrlReg = (() => {
    return /^\/([a-zA-Z]{0,20})\/([a-z0-9]{32})$/
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

wss.on('connection', async (ws, req) => {

    const path = req.url || ''
    let re: any = urlParse(path)
    if (isNone(re)) {
        ws.terminate()
        return
    }
    const cp = re.value as ChainPidT
    log.info('New connection')
    // 
    re = await connectHandler(ws, cp.chain, cp.pid)
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
        // TODO: Matcher
        G.delPuber(puber.id)
    })

    ws.on('error', (err) => {
        log.error('Connection error: ', err)
        ws.terminate()
        G.delPuber(puber.id)
        // TODO
    })
    return
})

const newPuber = (ws: WebSocket, chain: string, pid: IDT): Puber => {
    return {
        id: randomId(),
        pid,
        chain,
        ws
    }
}

const connectHandler = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {

    // connection limit TODO
    const isConnLimit = false
    if (isConnLimit) {
        ws.send('Connection out of limit')
        ws.terminate()
        return Err('Connection out of limit')
    }

    const puber = newPuber(ws, chain, pid)
    G.addPuber(puber)
    log.warn('New puber: ', G.getPubers())

    // regist matcher, Suber has to be pre-allocated
    const re = Matcher.regist(puber.id, chain)
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
    const suber = re.value as Suber
    Matcher.update(pubId, {originId: data.id})
    log.warn('matcher: ', Matcher.get(pubId))
    data.id = pubId   // id bind
    suber.ws.send(JSON.stringify(data)) 
}

const msgHandler = async (puber: Puber, data: WebSocket.Data): PVoidT => {
    // subscribed topic check
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

    const topics = G.getSubTopics(chain, pubId)
    // TODO: topic - params
    log.info('topic of chian project: ', topics)
    if (topics.indexOf(dat.method! || '') !== -1) {
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