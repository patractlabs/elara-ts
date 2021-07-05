import WebSocket from "ws"
import { getAppLogger } from "lib"
import { IDT, ResultT, PResultT, Ok, Err, isErr, isNone, PVoidT } from 'lib'
import { randomId, delays } from 'lib/utils'
import Conf from "../../config"
import Chain from "../chain"
import GG from '../global'
import { WsData, ReqT } from "../interface"
import Util from '../util'
import Pusumer from "."

const log = getAppLogger('matcher', true)

export enum ReqTyp {
    Sub,
    Unsub,
    Rpc,
    Close
}

interface Matcher {
    id: IDT,
    chain: string,
    url: string,
    ws: WebSocket,
    pusumers: Set<IDT>
}

export type MatcherMap = { [key in IDT]: Matcher }
export type ChainMatcher = { [key in string]: MatcherMap } 

namespace G {
    const Matchers: ChainMatcher = {}

    export const get = (chain: string, matId: IDT): ResultT => {
        chain = chain.toLowerCase()
        if (!Matchers[chain] || !Matchers[chain][matId]) {
            return Err(`No this matcher ${matId} of ${chain}`)
        }
        return Ok(Matchers[chain][matId])
    }

    export const getByChain = (chain: string): MatcherMap => {
        return Matchers[chain.toLowerCase()] || {}
    }

    export const getAll = (): ChainMatcher => {
        return Matchers
    }

    export const updateOrAdd = (chain: string, matcher: Matcher): void => {
        chain = chain.toLowerCase()
        const sub: MatcherMap = {}
        sub[matcher.id] = matcher
        Matchers[chain] = {
            ...Matchers[chain],
            ...sub
        }
    }

    export const del = (chain: string, matId: IDT): void => {
        chain = chain.toLowerCase()
        Matchers[chain][matId].pusumers?.clear()
        delete Matchers[chain][matId]
    }
}

const openHandler = (chain: string, matId: IDT, ws: WebSocket, pusumers: Set<IDT>) => {
    chain
    matId
    ws
    pusumers
}

const clearReqcache = async (pusumers: Set<IDT>) => {
    log.info('clear request cache of pusumers: ', pusumers)
    const reqs = GG.getAllReqCache()
    for (let reqId in reqs) {
        if (pusumers.has(reqs[reqId].pubId)) {
            GG.delReqCache(reqId)
        }
    }
}

const clearNonSubReqcache = (subId: IDT) => {
    const reqs = GG.getAllReqCache()
    for (let reqId in reqs) {
        if (reqs[reqId].subId === subId && reqs[reqId].type !== ReqTyp.Sub) {
            GG.delReqCache(reqId)
            log.info(`clear non-subscribe request cache: ${reqId}`)
        }
    }
} 

const closeHandler = async (chain: string, matcher: Matcher): PVoidT => {

    log.warn(`Try to connect chain[${chain}] failed out of limit, start to clear matcher resource.`)
    // clear pusumers context
    if (!matcher.pusumers) {
        log.info(`No pusumers need to be clear  chain ${chain} matcher[${matcher.id}]`)
        return
    }
    for (let pusId of matcher.pusumers) {
        let re = Pusumer.G.get(pusId)
        if (isNone(re)) {
            log.error(`[SBH] clear pusumer error: no this pusumer ${pusId}`)
            process.exit(1)
            continue
        }
        // close pusumer conn
        const pusumer = re.value as Pusumer 

        // TODO: matcher is unavailable now
        pusumer.ws.close(1000, 'cannot connect to server')
    }
}

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

const parseReq =  (dat: WsData): ResultT => {
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
        const re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`parse request cache error: no this request, pusumer has been closed.`)
            return Ok(true)
        }
        reqId = re.value 
    } else if(isUnsubOnClose(dat)) {
        // unsubscribe data when pusumer close
        const re = GG.getReqId((dat.id)!.toString())
        if (isErr(re)) {
            log.error(`parse unsubscribe data error: ${JSON.stringify(dat)}`)
            process.exit(1)
        }
        reqId = re.value    // the subscribe request id
        log.info(`unsubscribe result when pusumer closed,fetch subscribe request ${reqId}`)
    }

    let re = GG.getReqCache(reqId!)  
    if (isErr(re)) {
        // 
        log.error(`get request cache error: ${re.value}, pusumer has been closed `)
        return Ok(true)
        process.exit(1)
    }
    const req = re.value as ReqT
    if (dat.id && isUnsubOnClose(dat)) {
        log.info(`set unsubscribe request context when pusumer close`)
        // req.type = ReqTyp.Close   // to clear request cache
        req.params = req.subsId!
        req.originId = 0
    }
    return Ok(req)
}

const handleUnsubscribe = (req: ReqT, dres: boolean): void => {
    // rem subed topic, update pusumer.topics del submap
    // emit done event when pusumer.topics.size == 0
    const re = Pusumer.G.get(req.pubId)
    if (isNone(re)) {
        log.error(`handle unsubscribe error: no this pusumer ${req.pubId}`)
        process.exit(1)
    }
    const pusumer = re.value as Pusumer

    if (dres === false) {
        log.error(`Pusumer[${pusumer.id}] unsubscribe fail: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    } else {
        const subsId = req.params
        let re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`[SBH] unsubscribe topic[${req.method}] id[${subsId}] error: ${re.value}`)
            process.exit(1)
        }
        const reqId = re.value
        GG.delReqCache(reqId)

        GG.remSubTopic(req.chain, req.pid, subsId)

        GG.delSubReqMap(subsId)
        
        pusumer.topics?.delete(subsId)
        Pusumer.G.updateOrAdd(pusumer)
        log.info(`current topic size ${pusumer.topics?.size}, has event: ${pusumer.event !== undefined} of pusumer[${pusumer.id}]`)
        if (pusumer.topics?.size === 0 && pusumer.event) {
            pusumer.event?.emit('done')
            log.info(`all topic unsubescribe of pusumer[${pusumer.id}], emit pusumer clear done.`)
        }
        log.info(`Pusumer[${pusumer.id}] unsubscribe success: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    }
}

const dataParse = (data: WebSocket.Data): ResultT => {
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
        GG.delReqCache(req.id)
    }

    if (isSecondResp(dat.params)) {
        log.warn(`subscribe second response: ${JSON.stringify(dat)}`)
        return Ok({req, data})
    }

    const isClose = isUnsubOnClose(dat)
    const dres = dat.result
    dat.id = req.originId
    let dataToSend = JSON.stringify(dat)

    if (req.type === ReqTyp.Unsub || isClose) {
        handleUnsubscribe(req, dres)
        if (req.originId === 0) { return Ok(true) }
    } else if (isSubscribe(req.type === ReqTyp.Sub, dres)) {
        // first response of subscribe
        log.info(`first response of subscribe method[${req.method}] params[${req.params}] pusumer[${req.pubId}]: `, dat)
        const subsId = dat.result
  
        // WTF: set suscribe context, cannot be async, will race
        re = Matcher.setSubContext(req, subsId)
        if (isErr(re)) {
            return Err(`Set subscribe context of pusumer[${req.pubId}] topic[${req.method}] error: ${re.value}`)
        }
        log.info(`Pusumer[${req.pubId}] subscribe topic[${req.method}] params[${req.params}] successfully: ${subsId}`)
    } else if (dat.error) {
        log.error(`suber response error: ${JSON.stringify(dat)}`)
    } else {
        // rpc request, maybe big data package
        log.info(`New web socket response pusumer[${req.pubId}] method[${req.method}] params[${req.params}]`)
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({req, data: dataToSend}) 
}

const pusumerSend = (pubId: IDT, dat: WebSocket.Data) => {
    let re = Pusumer.G.get(pubId)
    if (isNone(re)) {
        log.error(`[SBH] invalid pusumer[${pubId}], may be closed`)
        process.exit(1)
        return
    }
    const pusumer = re.value as Pusumer
    pusumer.ws.send(dat)
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
        log.info(`unsubscribe topic done after pusumer closed: ${Util.globalStat()}`)
        return 
    }

    const {data, req} = re.value 
    pusumerSend(req.pubId, data)
    log.info(`new suber message of [${req.method}] parse time[${time}]:  `, Util.globalStat())
}

const newMatcher = (chain: string, url: string, pusumers?: Set<IDT>): Matcher => {
    const ws = new WebSocket(url, { perMessageDeflate: false })
    let matcher: any =  { id: randomId(), ws, url, chain, pusumers } as Matcher
    log.info('create new matcher with pusumer: ', pusumers)
    G.updateOrAdd(chain, matcher)

    ws.once('open', () => {
        log.info(`Websocket connection opened: chain[${chain}]`)

        GG.resetConnCnt(chain)   // reset chain connection count

        if (!pusumers || pusumers.size < 1) {
            return 
        }

        // reconnect to recover matcher or subscription
        openHandler(chain, matcher.id, ws, pusumers)
    })

    ws.on('error', (err) => {
        log.error(`${chain} matcher[${matcher.id}] socket error: `, err)
        matcher.ws.close()
    })

    ws.on('close', async (code: number, reason: string) => {
        log.error(`${chain} matcher[${matcher.id}] socket closed: `, code, reason)

        const re = G.get(chain, matcher.id)
        if (isErr(re)) {
            log.error(`Handle matcher close event error: `, re.value)
            process.exit(1)
        }

        const subTmp = re.value as Matcher
        // clear non-subscribe req cache  bind to matcher
        clearNonSubReqcache(subTmp.id)

        let pusumers = new Set(subTmp.pusumers) // new heap space
        const serConf = Conf.getServer()
        if (GG.getTryCnt(chain) >= serConf.maxReConn) {
            // try to clear request cache of matcher.pusumers before delete,
            // which wont clear on subscribe request cache
            clearReqcache(pusumers)
            // clear all the pusumer resource
            await closeHandler(chain, subTmp)
            pusumers = new Set<IDT>()  // clear pusumers after handle done
        }

        // delete matcher before
        delete matcher.ws
        G.del(chain, matcher.id)

        // try to reconnect
        delays(3, () => {
            log.warn(`create new matcher try to connect ${GG.getTryCnt(chain) + 1} times, pusumers `, pusumers)
            newMatcher(chain, url, pusumers)
            GG.incrTryCnt(chain)
        })
    })

    ws.on('message', msgCb)
    return matcher
}

const isOutofLimit = (chain: string, pid: IDT): boolean => {
    const wsConf = Conf.getServer()
    const curConn = 0   // TODO redis cache
    log.info(`current ws connection of chain ${chain} pid[${pid}]: ${curConn}/${wsConf.maxWsConn}`)
    if (curConn >= wsConf.maxWsConn) {
        log.warn(`websocket connection out of limit: ${chain} ${pid}`)
        return true
    }
    return false
}



namespace Matcher {

    export const Rpcs = [
        // kv with params
        "stat_subscribeStorage",

        // Node direct

        // special
        "author_submitAndWatchExtrinsic"    // author_unwatchExtrinsic
    ]

    export const init = async () => {

        const chains = Chain.G.getChains()
        if (chains.size < 1) {
            log.error(`no valid chain`)
            process.exit(2)
        }

        for (let chain of chains) {
            log.info('chain: ', chain)
        }

    }

    export const send = (chain: string, method: string, params: any[]) => {
        log.info(`new matcher request chain ${chain} method ${method} params ${params}`)
    }

    export const regist = async (ws: WebSocket, chain: string, pid: IDT): PResultT => {
        let re = isOutofLimit(chain, pid)
        if (re) { 
            ws.close(1002, 'out of connection limit')
            return Err('connection out of limit')
         }

        // create new pusumer 
        const pusumer = Pusumer.create(ws, chain, pid)

        // increase pusumer connection
        // TODO
        
        // log.info(`regist pusumer[${pusumer.id}] to matcher[${matcher.id}]: `, Util.globalStat())
        return Ok(pusumer)
    }

    export const setSubContext = (req: ReqT, subsId: string): ResultT => {
        // update subscribe request cache
        req.subsId = subsId
        GG.updateReqCache(req)

        // update submap
        GG.addSubReqMap(subsId, req.id)

        // update puber.topics
        let re = Pusumer.updateTopics(req.pubId, subsId)
        if (isErr(re)) {
            return Err(`update puber topics error: ${re.value}`)
        }
        const puber = re.value as Pusumer

        // add new subscribed topic
        GG.addSubTopic(puber.chain, puber.pid, {id: subsId, pubId: req.pubId, method: req.method, params: req.params})
   
        log.info(`After set subscribe context requestId[${req.id}] global stat: `, Util.globalStat())    // for test
        return Ok(0)
    }
}

export default Matcher