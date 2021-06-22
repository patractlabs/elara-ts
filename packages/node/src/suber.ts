import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { ReqT, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PVoidT, PResultT } from 'lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'
import Puber from './puber'
import Conf from '../config'
import Util from './util'

const log = getAppLogger('suber', true)

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const isUnsubscribe = (result: boolean) => {
    return result === true || result === false
}

const isSubscribe = (isSub: boolean, result: any): boolean => {
    return isSub && SubReg.test(result)
}

const isSubSecondResp = (params: any) => {
    return params 
}

const parseReqId =  (dat: WsData): ResultT => {
    let reqId = dat.id
    if (isSubSecondResp(dat.params)) {
        // log.warn('receive second response of subscribe: ', dat)
        const subsId = dat.params.subscription
        const re = G.getReqId(subsId)
        if (isErr(re)) {
            return Err(`SubReqMap invalid, subscription id [${subsId}]`)
        }
        reqId = re.value as IDT
    }
    return Ok(reqId)
}

const dataParse = async (data: WebSocket.Data): PResultT => {
    // or we can use string analyze than JSON.parse when data is big 
    const dat = JSON.parse(data as string)

    // NOTE: if asynclize parseReqId, 
    // subReqMap may uninit, then miss the first data response
    let re: any = parseReqId(dat)
    if (isErr(re)) {
        log.error(`parse request id error: `, re.value)
        return Err(`${re.value}`)
    }
    const reqId = re.value as IDT
    // handle method cache
    re = G.getReqCache(reqId)  
    if (isErr(re)) {
        if (dat.result === true) {
            // unsubscribe result after puber close
            log.info(`unsubscribe topic done after puber closed`)
            return Ok(true)
        }
        log.error(`get request cache error: `, re.value)
        return Err(`socket message parse error: ${re.value}`)
    }
    const req = re.value as ReqT

    // if suber close before message event,
    // this request Cache will clear before suber delete
    if (!req.isSubscribe) {
        // subscribe request cache will be clear 
        // on close or unsubscribe event
        log.warn('delete request cache: ', req.id)
        G.delReqCache(req.id)
    }

    if (isSubSecondResp(dat.params)) {
        return Ok({data, pubId: req.pubId})
    }

    const dres = dat.result
    dat.id = req.originId
    let dataToSend = Util.respFastStr(dat)

    if (isUnsubscribe(dres)) {
        log.warn(`Puber[${req.pubId}] unsubscribe topic[${req.method}] params[${req.params}] id[${req.subsId}] result: `, dres)
    } else if (isSubscribe(req.isSubscribe, dres)) {
        // first response of subscribe
        log.info(`first response of subscribe method[${req.method}] params[${req.params}] puber[${req.pubId}]: `, dat)
        const subsId = dat.result
        Puber.updateTopics(req.pubId, subsId)
  
        // WTF
        // set suscribe context, cannot be async, will race
        re = Matcher.setSubContext(req, subsId)
        if (isErr(re)) {
            return Err(`Set subscribe context of puber[${req.pubId}] topic[${req.method}] error: ${re.value}`)
        }
        log.info(`Puber[${req.pubId}] subscribe topic[${req.method}] params[${req.params}] successfully: ${subsId}`)
    } else {
        // rpc request, maybe big data package
        // TODO: maybe return {id: req.originId, data}
        log.info(`New web socket response puber[${req.pubId}] method[${req.method}] params[${req.params}]`)
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({data: dataToSend, pubId: req.pubId}) 
}

// send the message back to puber
const puberSend = async (pubId: IDT, dat: WebSocket.Data) => {
    let re = G.getPuber(pubId)
    if (isErr(re)) {
        log.error('Invalid puber: ', re.value)
        return
    }
    const puber = re.value as Puber
    // log.warn('call puber send: ', dat, Util.respStr(dat))
    // puber.ws.send(Util.respStr(dat))
    puber.ws.send(dat)
}

const msgCb = async (data: WebSocket.Data) => {
    const start = Util.traceStart()
    let re = await dataParse(data)
    const time = Util.traceEnd(start)

    // const time = Util.trace(start as TraceT)
    log.warn('new suber message parse time: ', time)
    if (isErr(re)) {
        log.error('Parse message data error: ', re.value)
        return
    }
    // Util.logGlobalStat() // for test
    if (re.value === true) { return }

    const send = re.value 
    puberSend(send.pubId, send.data)
}

const closeHandler = async (chain: string, suber: Suber): PVoidT => {

    log.warn(`Too many reconnection try of chain[${chain}], start to clear suber resource.`)
    // clear pubers context
    if (!suber.pubers) {
        log.warn(`No pubers need to be clear`)
        return
    }
    for (let pubId of suber.pubers) {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            // SBH
            log.error(`clear puber error: `, re.value)
            continue
        }
        // close puber conn
        const puber = re.value as Puber   
        puber.ws.close(1001, 'cannot connect to server')
    }
}

const recoverPuber = async (pubId: IDT, subId: IDT): PResultT => {
    let re = G.getPuber(pubId)
    if (isErr(re)) { return re }

    const puber = re.value as Puber

    // rematche subId
    puber.subId = subId
    G.updateAddPuber(puber)
    log.info(`Recover suber's id of puber[${pubId}] to: `, subId)
    return Ok(puber)
}

const recoverSubedTopic = (chain: string, pid: IDT, subsId: string): ResultT => {
    let re = G.getSubTopic(chain, pid, subsId)
    if (isErr(re)) {
        // try to clear
        log.error('recover subscribed topics error: ', re.value)
        G.remSubTopic(chain, pid, subsId)
        re = G.getReqId(subsId)
        G.delReqCache(re.value)
        G.delSubReqMap(subsId)
    }
 
    // send subscribe
    re = G.getReqId(subsId)
    if (isErr(re)) { return re }
    
    // update req cache
    re = G.getReqCache(re.value)
    const req = re.value as ReqT
    // SBH
    if (isErr(re)) { return re }

    return Ok(req)
}

const openHandler = async (chain: string, subId: IDT, ws: WebSocket, pubers: Set<IDT>) => {
    log.warn(`Into re-open handle chain[${chain}] suber[${subId}] pubers[${pubers.toString()}]`)
    for (let pubId of pubers) {
        log.warn('puber id to recover: ', pubId)
        let re = await recoverPuber(pubId, subId)
        if (isErr(re)) {
            log.error(`Handle re open error: `, re.value)
            continue
        }
        const puber = re.value as Puber
        if (!puber.topics) { 
            log.warn(`No topics need to recover of puber [${pubId}]`) 
            continue
        }
        // re subscribe topic
        for (let subsId of puber.topics!) {
            log.warn('subscribe topic id to recover: ', subsId)
            let re = recoverSubedTopic(chain, puber.pid, subsId)
            if (isErr(re)) {
                log.error(`Handle re open error: `, re.value)
                continue
            }
            const req = re.value as ReqT
            log.warn('request cache: ', req)
            let params = []
            if (req.params !== 'none') {
                params = JSON.parse(req.params)
            }
            ws.send(Util.reqFastStr({
                id: req.id, 
                jsonrpc: "2.0", 
                method: req.method, 
                params,
            }))

            // delete topic subed
            G.remSubTopic(chain, puber.pid, subsId)
            // delete subMap
            G.delSubReqMap(subsId)
            log.warn(`clear origin subscribe context of puber[${pubId}] chain ${chain}`)

            // no need to clear req cache, 
            // req.subsId will be update after new message received
            log.info(`Recover subscribed topic[${req.method}] params[${req.params}] of puber [${pubId}] done`)
        }
        log.info(`Recover puber[${pubId}] of chain ${chain} done`)
    }
}

const reqCacheClear = async (pubers: Set<IDT>) => {
    log.info('clear request cache of pubers: ', pubers)
    const reqs = G.getAllReqCache()
    for (let reqId in reqs) {
        if (pubers.has(reqs[reqId].pubId)) {
            G.delReqCache(reqId)
        }
    }
}

const newSuber = (chain: string, url: string, pubers?: Set<IDT>): Suber => {
    // chain valid check
    // Dao.getChainConfig(chain)
    const ws = new WebSocket(url, { perMessageDeflate: false })
    let suber: any =  { id: randomId(), ws, url, chain, pubers } as Suber
    log.info('create new suber with puber: ', pubers)
    G.updateAddSuber(chain, suber)

    ws.once('open', () => {
        log.info(`Websocket connection opened: chain[${chain}]`)

        G.resetConnCnt(chain)   // reset chain connection count

        if (!pubers || pubers.size < 1) {
            return 
        }

        // reconnect to recover matcher or subscription
        openHandler(chain, suber.id, ws, pubers)
    })

    ws.on('error', (err) => {
        log.error(`${chain} suber[${suber.id}] socket error: `, err)
        suber.ws.close()
    })

    ws.on('close', async (code: number, reason: string) => {
        log.error(`${chain} suber[${suber.id}] socket closed: `, code, reason)

        const re = G.getSuber(chain, suber.id)
        if (isErr(re)) {
            log.error(`Handle suber close event error: `, re.value)
            return
        }
        const subTmp = re.value as Suber
        let pubers = new Set(subTmp.pubers) // new heap space
        log.warn(`Ready to create new suber, transmit pubers: `, pubers)
        const serConf = Conf.getServer()
        if (G.getTryCnt(chain) >= serConf.maxReconnTry) {
            // try to clear request cache of suber.pubers before delete,
            // which wont clear on subscribe request cache
            reqCacheClear(pubers)
            // clear all the puber resource
            await closeHandler(chain, subTmp)
            pubers = new Set<IDT>()  // clear pubers after handle done
        }

        // delete suber before
        delete suber.ws
        G.delSuber(chain, suber.id)
        suber = null    // ?

        // try to reconnect
        delays(3, () => {
            log.warn(`create new suber try to connect ${G.getTryCnt(chain) + 1} times, pubers `, pubers)
            newSuber(chain, url, pubers)
            G.incrTryCnt(chain)
        })
    })

    ws.on('message', msgCb)
    return suber
}

const geneUrl = (conf: ChainConfig) => {
    return `ws://${conf.baseUrl}:${conf.wsPort}`
}

interface Suber {
    id: IDT,
    chain: string,
    url: string,
    ws: WebSocket,
    pubers?: Set<IDT>,    // {pubId}
}

namespace Suber {

    export const selectSuber = async (chain: string): PResultT => {
    
        const subers = G.getChainSubers(chain)
        const keys = Object.keys(subers)
        if (!keys || keys.length < 1) {
            log.error('Select suber error: no valid subers of chain ', chain)
            return Err(`No valid suber of chain[${chain}]`)
        }
        const ind = G.getID() % keys.length
        return Ok(subers[keys[ind]])
    }

    export const initChainSuber = async (chain: string, poolSize: number) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.warn(`Config of chain[${chain}] invalid`)    
            return 
        }
        const serConf = Conf.getServer()
        // NOTE: `!==` wont true
        if (serConf.id != (conf.value as ChainConfig).serverId) { 
            log.warn(`Chain[${chain}] bind to server ${conf.value.serverId}, skip! current server is ${serConf.id}`)
            return 
        }
        G.addChain(chain)
        const url = geneUrl(conf.value)
        log.info(`Url of chain [${chain}] is: `, url, G.getChains())
        for (let i = 0; i < poolSize; i++) {                
            newSuber(chain, url, new Set())
        }
    }

    export const init = async () => {
        // fetch chain list
        const re = await Chain.fetchChains()
        if (isErr(re)) {
            log.error(`Init chain list error: `, re.value)
            process.exit(1)
        }
        const chains = re.value as string[]
        // config
        const wsConf = Conf.getWs()
        log.info(`NODE_ENV is ${process.env.NODE_ENV}, pool size ${wsConf.poolSize}`)
        for (let c of chains) {
            initChainSuber(c, wsConf.poolSize)
        }
        log.info('Init completely.')
    }
}

export default Suber