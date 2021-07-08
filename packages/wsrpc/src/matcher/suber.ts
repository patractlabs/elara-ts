import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { ReqT, ReqTyp, WsData, ChainSuber, SuberMap } from '../interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PResultT, isNone, Option, None, Some } from 'lib'
import GG from '../global'
import Chain from '../chain'
import Dao from '../dao'
import Matcher from '.'
import Puber from '../puber'
import Conf from '../../config'
import Util from '../util'
import Topic from './topic'

const log = getAppLogger('suber', process.env.NODE_ENV === 'dev')

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const isSubID = (id: string): boolean => {
    const tr = SubReg.test(id)
    const tl = id.length === 16
    // log.warn(`test result: `, tr, tl)
    return  tr && tl
}

const isSubscribe = (isSub: boolean, result: any): boolean => {
    // log.warn('test sub: ', result)
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
    log.info('parse new response: ', JSON.stringify(dat))
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
            log.error(`parse request cache error: ${re.value}, puber has been closed.`)
            return Ok(true)
        }
        reqId = re.value 
    } else if(isUnsubOnClose(dat)) {
        // unsubscribe data when puber close
        const re = GG.getReqId((dat.id)!.toString())
        if (isErr(re)) {
            log.error(`parse unsubscribe data error: ${JSON.stringify(dat)}`)
            process.exit(1)
        }
        reqId = re.value    // the subscribe request id
        log.info(`unsubscribe result when puber closed,fetch subscribe request ${reqId}`)
    }

    let re = GG.getReqCache(reqId!)  
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
    const re = Puber.G.get(req.pubId)
    if (isNone(re)) {
        log.error(`handle unsubscribe error: invalid puber ${req.pubId}`)
        process.exit(1)
    }
    const puber = re.value as Puber

    if (dres === false) {
        log.error(`Puber[${puber.id}] unsubscribe fail: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
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
        
        puber.topics?.delete(subsId)
        Puber.G.updateOrAdd(puber)
        log.info(`current topic size ${puber.topics?.size}, has event: ${puber.event !== undefined} of puber[${puber.id}]`)
        if (puber.topics?.size === 0 && puber.event) {
            puber.event?.emit('done')
            log.info(`all topic unsubescribe of puber[${puber.id}], emit puber clear done.`)
        }
        log.info(`Puber[${puber.id}] unsubscribe success: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    }
}

/// 1. rpc response: clear reqcache, replace originid 
/// 2. subscribe first response
/// 3. subscribe response non-first
/// 4. error response
/// 5. unsubscribe response
const dataParse = (data: WebSocket.Data, subType: SuberTyp): ResultT => {
    let dat = JSON.parse(data as string)
    if (subType === SuberTyp.Kv) {
        if (dat.data) {
            // subscribe response
            dat = JSON.parse(dat.data)
        } else if (dat.result) {
            dat = JSON.parse(dat.result)
        }
        // dat.error: no need handle
        
        log.warn(`new kv response: ${JSON.stringify(dat)}`)
    }
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
    if (dat.error || req.type !== ReqTyp.Sub) {
        // subscribe request cache will be clear on unsubscribe event
        GG.delReqCache(req.id)
        log.info('delete request cache non-subscribe: ', req.id, JSON.stringify(req))
    }

    if (isSecondResp(dat.params)) {
        log.warn(`subscribe second response: ${JSON.stringify(dat)}`)
        return Ok({req, data})
    }

    const isClose = isUnsubOnClose(dat)
    const dres = dat.result
    dat.id = req.originId
    let dataToSend = Util.respFastStr(dat)
    if (dat.error) {
        log.error(`suber response error: ${JSON.stringify(dat)}`)
    } else if (req.type === ReqTyp.Unsub || isClose) {
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
    } else {
        // rpc request, maybe big data package
        log.info(`New web socket response puber[${req.pubId}] method[${req.method}] params[${req.params}]`)
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({req, data: dataToSend}) 
}

const puberSend = (pubId: IDT, dat: WebSocket.Data) => {
    let re = Puber.G.get(pubId)
    if (isNone(re)) {
        log.error(`[SBH] invalid puber ${pubId}, may be closed`)
        process.exit(1)
    }
    const puber = re.value as Puber
    puber.ws.send(dat)
}

// const msgCb = (dat: WebSocket.Data) => {
//     const start = Util.traceStart()
//     let re = dataParse(dat)
//     const time = Util.traceEnd(start)

//     if (isErr(re)) {
//         log.error('Parse suber message data error: ', re.value)
//         return
//     }
//     if (re.value === true) { 
//         log.info(`unsubscribe topic done after puber closed: ${Util.globalStat()}`)
//         return 
//     }

//     const {data, req} = re.value 
//     puberSend(req.pubId, data)
//     log.info(`new suber message of [${req.method}] parse time[${time}]:  `, Util.globalStat())
// }

const recoverPuberTopics = (puber: Puber, ws: WebSocket, subsId: string) => {
    const {id, chain} = puber
    puber.topics!.delete(subsId)
    let re = GG.getReqId(subsId)
    if (isErr(re)) { 
        log.error(`revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }
    re = GG.getReqCache(re.value)
    if (isErr(re)) {
        log.error(`revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }

    const req = re.value as ReqT
    log.info(`recover new subscribe topic request: ${JSON.stringify(req)}`)
    let data: any = {
        id: req.id, 
        jsonrpc: "2.0", 
        method: req.method, 
        params: req.params || [],
    }
    if (req.subType === SuberTyp.Kv) {
        data = {
            id: req.id,
            chain: chain,
            request: JSON.stringify(data)
        }
    }
    ws.send(Util.reqFastStr(data))

    // delete topic subed
    GG.remSubTopic(chain, puber.pid, subsId)
    // delete subMap
    GG.delSubReqMap(subsId)

    // no need to clear req cache, 
    // req.subsId will be update after new message received
    log.info(`Recover subscribed topic[${req.method}] params[${req.params}] of puber [${id}] done`)
}

const openHandler = async (chain: string, subId: IDT, ws: WebSocket, pubers: Set<IDT>) => {
    log.info(`Into re-open handle chain[${chain}] suber[${subId}] pubers[${pubers}]`)
    for (let pubId of pubers) {
        let re = Puber.G.get(pubId)
        if (isNone(re)) {
            log.error(`Handle re open error: invalid puber ${pubId}`)
            process.exit(2)
        }
        const puber = re.value as Puber
        // update suber id
        puber.subId = subId
        if (!puber.topics) { 
            log.info(`No topics need to recover of puber [${pubId}]`) 
            Puber.G.updateOrAdd(puber)
            continue
        }
        // re subscribe topic
        for (let subsId of puber.topics!) {
            recoverPuberTopics(puber, ws, subsId)
        }
        Puber.G.updateOrAdd(puber)
        log.info(`Recover puber[${pubId}] of chain ${chain} done`)
    }
}

// suber close relate
// const isSuberClosed = (reason: Puber.CloseReason): boolean => {
//     return reason === Puber.CloseReason.Kv || reason === Puber.CloseReason.Node
// }

// suber close relate
// const closeHandler = async (chain: string, subType: SuberTyp, suber: Suber, reason: Puber.CloseReason): PVoidT => {
//     /// clear the other type suber
//     log.warn(`Try to connect chain[${chain}] failed out of limit, start to clear suber ${suber.id}: ${subType}`)
//     // clear pubers context
//     if (!suber.pubers) {
//         log.info(`No pubers need to be clear  chain ${chain} suber[${suber.id}]`)
//         return
//     }
//     for (let pubId of suber.pubers) {
//         let re: any = Puber.G.get(pubId)
//         if (isNone(re)) {
//             log.error(`[SBH] clear puber error: invalid puber ${pubId}`)
//             process.exit(1)
//         }
//         const puber = re.value as Puber   
//         // close the other suber
//         let subId
//         let typ
//         let creason
//         if (subType === SuberTyp.Kv) {
//             subId = puber.subId
//             typ = SuberTyp.Node
//             creason = Puber.CloseReason.Kv
//         } else {
//             subId = puber.kvSubId
//             typ = SuberTyp.Kv
//             creason = Puber.CloseReason.Node
//         }
//         if (!isSuberClosed(reason) && reason !== creason) {
//             re = Suber.G.get(chain, typ, subId!)
//             const sub = re.value as Suber
//             sub.ws.close(1000, creason)
//         }

//         // close puber conn
//         puber.ws.close(1000, creason)
//     }
//     log.error()
// }

// suber close relate
// const clearReqcache = async (pubers: Set<IDT>) => {
//     log.info('clear request cache of pubers: ', pubers)
//     const reqs = GG.getAllReqCache()
//     for (let reqId in reqs) {
//         if (pubers.has(reqs[reqId].pubId)) {
//             GG.delReqCache(reqId)
//         }
//     }
// }

const clearNonSubReqcache = (subId: IDT) => {
    // TODO: by suber & puber
    const reqs = GG.getAllReqCache()
    for (let reqId in reqs) {
        if (reqs[reqId].subId === subId && reqs[reqId].type !== ReqTyp.Sub) {
            GG.delReqCache(reqId)
            log.info(`clear non-subscribe request cache: ${reqId}`)
        }
    }
}

const newSuber = (chain: string, url: string, type: SuberTyp, pubers?: Set<IDT>): Suber => {
    // chain valid check
    // Dao.getChainConfig(chain)
    const ws = new WebSocket(url, { perMessageDeflate: false })
    let suber: any =  { id: randomId(), ws, url, chain, type, stat: SuberStat.Create, pubers } as Suber
    log.info('create new suber with puber: ', pubers)
    Suber.G.updateOrAdd(chain, type, suber)

    ws.once('open', () => {
        log.info(`Websocket connection opened: chain[${chain}]`)

        GG.resetTryCnt(chain)   // reset chain connection count

        // update suber status
        let re = Suber.G.get(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`update suber on open error: invalid suber ${suber.id} chain ${chain} type ${type}`)
            process.exit(2)
        }
        const subTmp = re.value as Suber
        subTmp.stat = SuberStat.Active
        Suber.G.updateOrAdd(chain, type, suber)

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

        const re = Suber.G.get(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`Handle suber close event error: invalid suber ${suber.id} of chain ${chain}`)
            process.exit(1)
        }

        const subTmp = re.value as Suber
        // clear non-subscribe request cache  bind to suber
        clearNonSubReqcache(subTmp.id)

        let pubers = new Set(subTmp.pubers) // new heap space
        const curTryCnt = GG.getTryCnt(chain)

        /// this tryCnt is shared by all the subers of this chain.
        /// Kv suber and Node suber maybe close at one time all both failed.
        /// Since Kv suber and Node suber is bind to the same puber, if one of 
        /// they fail we try to clear the other suber too.
        /// Specially, Kv suber is a subset of Node suber, while the Kv suber 
        /// offer the most subscribe business, we may take another strategy to 
        /// manage the suber resource.
        
        // NOTE: wont clear suber now, keeping try connect
        // const serConf = Conf.getServer()
        // if (curTryCnt >= serConf.maxReConn) {
        //     // try to clear subscribe request cache of suber.pubers before delete,
        //     // which wont clear after suber close
        //     clearReqcache(pubers)
        //     // clear all the puber resource
        //     await closeHandler(chain, type, subTmp, reason as Puber.CloseReason)
        //     pubers = new Set<IDT>()  // clear pubers after handle 
        //     GG.resetTryCnt(chain)
        //     delete suber.ws
        //     Suber.G.del(chain, type, suber.id)
        //     // cannog re connet,for one of the suber is available, if the subscribe
        //     // context wont clear done, the re-connection will race
        //     // TODO: chain suber realloc
        //     // update this chain status to fail
        //     return
        // }

        // delete suber before
        delete suber.ws
        Suber.G.del(chain, type, suber.id)

        // try to reconnect after 5 second
        delays(5, () => {
            log.warn(`create new suber try to connect ${curTryCnt + 1} times, pubers `, pubers)
            newSuber(chain, url, type, pubers)
            GG.incrTryCnt(chain)
        })
    })

    ws.on('message', (dat: WebSocket.Data) => {
        const start = Util.traceStart()
        let re = dataParse(dat, type)
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
    })
    return suber
}

const geneUrl = (conf: ChainConfig): string[] => {
    let res = [`ws://${conf.baseUrl}:${conf.wsPort}`]
    
    if (conf.kvEnable) {
        let url = conf.kvBaseUrl!
        let port = conf.kvPort!
        res.push(`ws://${url}:${port}`)
    }
    return res
}

export enum SuberTyp {
    Kv = 'kv',
    Node = 'node'
}

export enum SuberStat {
    Active,
    Create,
    Failed
}

interface Suber {
    id: IDT,
    chain: string,
    url: string,
    ws: WebSocket,
    type: SuberTyp,
    stat: SuberStat,
    pubers?: Set<IDT>,    // {pubId}
}

namespace Suber {

    export namespace G {
        /**
         * Subers {
         *  'polkadot': {
         *      'f90dc072e006d5f6f8fbe33e565d274f': {
         *          id: 'f90dc072e006d5f6f8fbe33e565d274f',
         *          url: '127.0.0.1:9944',
         *          chain: 'polkadot',
         *          ws: WebSocketObject,
         *          pubers: ['852c5949c10b2797dedad388fa745110']
         *       }
         *   }
         * }
         */
        const Subers: ChainSuber = {}

        export const get = (chain: string, type: SuberTyp, subId: IDT): Option<Suber> => {
            chain = chain.toLowerCase()
            const ct = `${chain}-${type}`
            if (!Subers[ct] || !Subers[ct][subId]) {
                return None
            }
            return Some(Subers[ct][subId])
        }
    
        export const getByChain = (chain: string, type: SuberTyp,): SuberMap => {
            const ct = `${chain.toLowerCase()}-${type}`
            return Subers[ct] || {}
        }
    
        export const getAll = (): ChainSuber => {
            return Subers
        }
    
        export const updateOrAdd = (chain: string, type: SuberTyp, suber: Suber): void => {
            chain = chain.toLowerCase()
            const ct = `${chain}-${type}`
            const sub: SuberMap = {}
            sub[suber.id] = suber
            Subers[ct] = {
                ...Subers[ct],
                ...sub
            }
        }
    
        export const del = (chain: string, type: SuberTyp, subId: IDT): void => {
            chain = chain.toLowerCase()
            const ct = `${chain}-${type}`
            Subers[ct][subId].pubers?.clear()
            delete Subers[ct][subId]
        }
    }

    export const selectSuber = async (chain: string, type: SuberTyp,): PResultT => {
    
        const subers = G.getByChain(chain, type)
        const keys = Object.keys(subers)
        if (!keys || keys.length < 1) {
            log.error('Select suber error: no valid subers of chain ', chain)
            return Err(`No valid suber of chain[${chain}]`)
        }
        const ind = GG.getID() % keys.length
        const suber = subers[keys[ind]]
        if (suber.stat !== SuberStat.Active) {
            log.error(`suber is inactive`)
            return Err(`suber inactive`)
        }
        return Ok(suber)
    }

    export const initChainSuber = async (chain: string, poolSize: number) => {
        const re = await Dao.getChainConfig(chain)
        if (isErr(re)) { 
            log.error(`Config of chain[${chain}] invalid`)    
            return 
        }
        const conf = re.value as ChainConfig
        const urls = geneUrl(conf)
        log.info(`Url of chain [${chain}] is: ${urls} kv enable [${conf.kvEnable}]`)
        for (let i = 0; i < poolSize; i++) {     
                       
            newSuber(chain, urls[0], SuberTyp.Node, new Set())

            // kv Suber
            if (conf.kvEnable) {
                newSuber(chain, urls[1], SuberTyp.Kv, new Set())
            }
        }
    }

    export const init = async () => {
        // fetch chain list
        const chains = Chain.G.getChains()
        
        // config
        const wsConf = Conf.getWsPool()
        log.info(`NODE_ENV is ${process.env.NODE_ENV}, pool size ${wsConf.poolSize}`)
        for (let chain of chains) {
            log.info(`init suber of chain ${chain}`)
            initChainSuber(chain, wsConf.poolSize)
        }
        log.info('Init completely.')
    }

    export const unsubscribe = async (chain: string, type: SuberTyp, subId: IDT, topic: string, subsId: string) => {
        // TODO: kv unsuber {id, chain, request}
        const re = G.get(chain, type, subId)
        if (isNone(re)) {
            log.error(`[SBH] get suber to unsubcribe error: invalid suber ${subId} of chain ${chain}`)
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