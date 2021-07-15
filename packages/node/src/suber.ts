import { randomId } from 'elara-lib/utils'
import WebSocket from 'ws'
import { ReqT, ReqTyp, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PVoidT, PResultT } from 'elara-lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'
import Puber from './puber'
import Conf from '../config'
import Util from './util'
import Topic from './topic'

const log = getAppLogger('suber', process.env.NODE_ENV === 'dev')

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

// const isUnsubscribe = (result: boolean, req: ReqT): boolean => {
//     // method
//     if (result === true || result === false) {
//         return req.isUnsubscribe
//     }
//     return false
// }

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const isSubID = (id: string): boolean => {
    return SubReg.test(id) && id.length === 16
}

const isSubscribe = (isSub: boolean, result: any): boolean => {
    return isSub && isSubID(result)
}

const isSecondResp = (params: any) => {
    // no need to replace origin id
    return params !== undefined
}

const isUnsubOnClose = (dat: WsData): boolean => {
    if (!dat.id) { return false }
    const isBool: boolean = dat.result === true || dat.result === false
    return isSubID(dat.id!.toString()) && isBool
}

const parseReq =  (dat: WsData): ResultT<ReqT|boolean> => {
    log.info('parse new request: ', JSON.stringify(dat))
    let reqId = dat.id // maybe null

    if (dat.id === null) {
        log.error(`Unexcepted response null id: ${dat}`)
        return Err(`null id response: ${dat}`)
    }
    
    // log.warn('sub test: ', isSubID(dat.id!.toString()))
    if (isSecondResp(dat.params)) {
        const subsId = dat.params.subscription
        log.info('receive second response of subscribe: ', subsId)
        const re = G.getReqId(subsId)
        if (isErr(re)) {
            log.error(`parse request cache error: ${re.value}, puber has been closed.`)
            return Ok(true)
        }
        reqId = re.value as IDT
    } else if(isUnsubOnClose(dat)) {
        // unsubscribe data when puber close
        const re = G.getReqId((dat.id)!.toString())
        if (isErr(re)) {
            log.error(`parse unsubscribe data error: ${JSON.stringify(dat)}`)
            process.exit(1)
        }
        reqId = re.value    // the subscribe request id
        log.info(`unsubscribe result when puber closed,fetch subscribe request ${reqId}`)
    }

    let re = G.getReqCache(reqId!)  
    if (isErr(re)) {
        // 
        log.error(`get request cache error: ${re.value}, puber has been closed `)
        return Ok(true)
        process.exit(1)
    }
    const req = re.value as ReqT
    if (dat.id && isUnsubOnClose(dat)) {
        log.info(`set unsubscribe request context when puber close`)
        // req.type = ReqTyp.Close   // to clear request cache
        req.params = req.subsId!
        req.originId = 0
    }
    return Ok(req)
}

const handleUnsubscribe = (req: ReqT, dres: boolean): void => {
    // rem subed topic, update puber.topics del submap
    // emit done event when puber.topics.size == 0
    const re = G.getPuber(req.pubId)
    if (isErr(re)) {
        log.error(`handle unsubscribe error: ${re.value}`)
        process.exit(1)
    }
    const puber = re.value as Puber

    if (dres === false) {
        log.error(`Puber[${puber.id}] unsubscribe fail: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    } else {
        const subsId = req.params
        let re = G.getReqId(subsId)
        if (isErr(re)) {
            log.error(`[SBH] unsubscribe topic[${req.method}] id[${subsId}] error: ${re.value}`)
            process.exit(1)
        }
        const reqId = re.value
        G.delReqCache(reqId)

        G.remSubTopic(req.chain, req.pid, subsId)

        G.delSubReqMap(subsId)
        
        puber.topics?.delete(subsId)
        G.updateAddPuber(puber)
        log.info(`current topic size ${puber.topics?.size}, has event: ${puber.event !== undefined} of puber[${puber.id}]`)
        if (puber.topics?.size === 0 && puber.event) {
            puber.event?.emit('done')
            log.info(`all topic unsubescribe of puber[${puber.id}], emit puber clear done.`)
        }
        log.info(`Puber[${puber.id}] unsubscribe success: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    }
}
type DParT = {
    req: ReqT,
    data: string | WebSocket.Data | boolean
}

/// 1. rpc response: clear reqcache, replace originid 
/// 2. subscribe first response
/// 3. subscribe response non-first
/// 4. error response
/// 5. unsubscribe response
const dataParse = (data: WebSocket.Data): ResultT<DParT> => {
    const dat = JSON.parse(data as string)

    // NOTE: if asynclize parseReqId, 
    // subReqMap may uninit, then miss the first data response
    let re: any = parseReq(dat)
    if (isErr(re)) {
        log.error(`parse request cache error: `, re.value)
        return Err(`${re.value}`)
    }
    if (re.value === true) {
        return re
    }

    const req = re.value as ReqT
    log.info('parse request cache result: ', JSON.stringify(req))
    // if suber close before message event,
    // request Cache will clear before suber delete
    if (req.type !== ReqTyp.Sub) {
        // subscribe request cache will be clear on unsubscribe event
        log.info('delete request cache non-subscribe: ', req.id)
        G.delReqCache(req.id)
    }

    if (isSecondResp(dat.params)) {
        log.warn(`subscribe second response: ${JSON.stringify(dat)}`)
        return Ok({req, data})
    }

    const isClose = isUnsubOnClose(dat)
    const dres = dat.result
    dat.id = req.originId
    let dataToSend = Util.respFastStr(dat)

    if (req.type === ReqTyp.Unsub || isClose) {
        handleUnsubscribe(req, dres)
        if (req.originId === 0) { return Ok(true) }
    } else if (isSubscribe(req.type === ReqTyp.Sub, dres)) {
        // first response of subscribe
        log.info(`first response of subscribe method[${req.method}] params[${req.params}] puber[${req.pubId}]: `, dat)
        const subsId = dat.result
  
        // WTF: set suscribe context, cannot be async, will race
        re = Matcher.setSubContext(req, subsId)
        if (isErr(re)) {
            return Err(`Set subscribe context of puber[${req.pubId}] topic[${req.method}] error: ${re.value}`)
        }
        log.info(`Puber[${req.pubId}] subscribe topic[${req.method}] params[${req.params}] successfully: ${subsId}`)
    } else if (dat.error) {
        log.error(`suber response error: ${JSON.stringify(dat)}`)
    } else {
        // rpc request, maybe big data package
        log.info(`New web socket response puber[${req.pubId}] method[${req.method}] params[${req.params}]`)
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({req, data: dataToSend}) 
}

const puberSend = (pubId: IDT, dat: WebSocket.Data) => {
    let re = G.getPuber(pubId)
    if (isErr(re)) {
        log.error(`[SBH] invalid puber[${pubId}], may be closed`)
        process.exit(1)
        return
    }
    const puber = re.value as Puber
    puber.ws.send(dat)
}

const msgCb = (dat: WebSocket.Data) => {
    const start = Util.traceStart()
    let re = dataParse(dat)
    const time = Util.traceEnd(start)

    if (isErr(re)) {
        log.error('Parse suber message data error: ', re.value)
        return
    }
    if (re.value === true) { 
        log.info(`unsubscribe topic done after puber closed: ${Util.globalStat()}`)
        return 
    }

    const {data, req} = re.value 
    puberSend(req.pubId, data)
    log.info(`new suber message of [${req.method}] parse time[${time}]:  `, Util.globalStat())
}

const closeHandler = async (chain: string, suber: Suber): PVoidT => {

    log.warn(`Try to connect chain[${chain}] failed out of limit, start to clear suber resource.`)
    // clear pubers context
    if (!suber.pubers) {
        log.info(`No pubers need to be clear  chain ${chain} suber[${suber.id}]`)
        return
    }
    for (let pubId of suber.pubers) {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            log.error(`[SBH] clear puber error: `, re.value)
            process.exit(1)
            continue
        }
        // close puber conn
        const puber = re.value as Puber   

        // TODO: suber is unavailable now
        puber.ws.close(1000, 'cannot connect to server')
    }
}

const recoverPuberTopics = (puber: Puber, ws: WebSocket, subsId: string) => {
    const {id, chain} = puber
    puber.topics!.delete(subsId)
    let re = G.getReqId(subsId)
    if (isErr(re)) { 
        log.error(`revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }
    re = G.getReqCache(re.value)
    if (isErr(re)) {
        log.error(`revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }

    const req = re.value as ReqT
    log.info(`recover new subscribe topic request: ${JSON.stringify(req)}`)
    ws.send(Util.reqFastStr({
        id: req.id, 
        jsonrpc: "2.0", 
        method: req.method, 
        params: req.params || [],
    }))

    // delete topic subed
    G.remSubTopic(chain, puber.pid, subsId)
    // delete subMap
    G.delSubReqMap(subsId)

    // no need to clear req cache, 
    // req.subsId will be update after new message received
    log.info(`Recover subscribed topic[${req.method}] params[${req.params}] of puber [${id}] done`)
}

const openHandler = async (chain: string, subId: IDT, ws: WebSocket, pubers: Set<IDT>) => {
    log.info(`Into re-open handle chain[${chain}] suber[${subId}] pubers[${pubers.values()}]`)
    for (let pubId of pubers) {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            log.error(`Handle re open error: `, re.value)
            process.exit(2)
        }
        const puber = re.value as Puber
        // update suber id
        puber.subId = subId
        if (!puber.topics) { 
            log.info(`No topics need to recover of puber [${pubId}]`) 
            G.updateAddPuber(puber)
            continue
        }
        // re subscribe topic
        for (let subsId of puber.topics!) {
            recoverPuberTopics(puber, ws, subsId)
        }
        G.updateAddPuber(puber)
        log.info(`Recover puber[${pubId}] of chain ${chain} done`)
    }
}

const clearReqcache = async (pubers: Set<IDT>) => {
    log.info('clear request cache of pubers: ', pubers)
    const reqs = G.getAllReqCache()
    for (let reqId in reqs) {
        if (pubers.has(reqs[reqId].pubId)) {
            G.delReqCache(reqId)
        }
    }
}

const clearNonSubReqcache = (subId: IDT) => {
    const reqs = G.getAllReqCache()
    for (let reqId in reqs) {
        if (reqs[reqId].subId === subId && reqs[reqId].type !== ReqTyp.Sub) {
            G.delReqCache(reqId)
            log.info(`clear non-subscribe request cache: ${reqId}`)
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
            process.exit(1)
        }

        const subTmp = re.value as Suber
        // clear non-subscribe req cache  bind to suber
        clearNonSubReqcache(subTmp.id)

        let pubers = new Set(subTmp.pubers) // new heap space
        const serConf = Conf.getServer()
        if (G.getTryCnt(chain) >= serConf.maxReconnTry) {
            // try to clear request cache of suber.pubers before delete,
            // which wont clear on subscribe request cache
            clearReqcache(pubers)
            // clear all the puber resource
            await closeHandler(chain, subTmp)
            pubers = new Set<IDT>()  // clear pubers after handle done
        }

        // delete suber before
        delete suber.ws
        G.delSuber(chain, suber.id)

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
            log.error(`Config of chain[${chain}] invalid`)    
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

    export const unsubscribe = async (chain: string, subId: IDT, topic: string, subsId: string) => {
        const re = G.getSuber(chain, subId)
        if (isErr(re)) {
            log.error('[SBH] get suber to unsubcribe error: ', re.value)
            process.exit(1)
        }
        const suber = re.value as Suber
        const unsub = {
            id: subsId,   // NOTE: have to be the subscribe ID
            jsonrpc: '2.0',
            method: Topic.getUnsub(topic),
            params: [subsId]
        }
        suber.ws.send(Util.reqFastStr(unsub))
        log.info(`Suber[${subId}] send unsubcribe topic[${topic}] id[${subsId}] of chain ${chain} `, chain, subId, topic, subsId)
    }

    export const isSubscribeID = (id: string): boolean => {
        return isSubID(id)
    }
}

export default Suber