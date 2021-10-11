import { PVoidT, randomId } from '@elara/lib'
import WebSocket from 'ws'
import { ReqT, ReqTyp, WsData, CloseReason, ChainSuber, SuberMap, SubscripT } from '../interface'
import { getAppLogger, isErr, IDT, Err, Ok, isSome, PResultT, isNone, Option, Some, None } from '@elara/lib'
import GG from '../global'
import Chain, { ChainInstance, NodeType } from '../chain'
import Dao from '../dao'
import Matcher from '../matcher'
import Puber from '../puber'
import Util from '../util'
import Topic from '../matcher/topic'
import G from '../global'
import Emiter from '../emiter'

const log = getAppLogger('suber')

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

function delays(sec: number, cb: () => void) {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

function isSubscribeID(id: string): boolean {
    const okLen = id?.length === 16 ?? false // make sure length equals 16
    if (!okLen) return false
    return SubReg.test(id)
}

function isSubRequest(reqType: ReqTyp, isSubId: boolean): boolean {
    return reqType === ReqTyp.Sub && isSubId
}

function isSecondResp(params: any) {
    // no need to replace origin id
    return params !== undefined
}

function isUnsubOnClose(dat: WsData, isSubId: boolean): boolean {
    if (!dat.id) { return false }
    const isBool: boolean = dat.result === true || dat.result === false
    return isSubId && isBool
}

async function parseReq(dat: WsData, chain: string): PResultT<ReqT | boolean> {
    let reqId = dat.id // maybe null

    if (dat.id === null) {
        log.error(`Unexcepted ${chain} response null id: ${dat}`)
        return Err(`${chain} null id response: ${dat}`)
    }

    if (isSecondResp(dat.params)) {
        const subsId = dat.params.subscription
        const re = GG.getReqId(subsId)
        if (isErr(re)) {
            Dao.cacheSubscribeResponse(subsId, dat)
            log.error(`${chain} parse request cache error: ${re.value}, puber has been closed.`)
            return Ok(true)
        }
        reqId = re.value
    } else if (isUnsubOnClose(dat, isSubscribeID(dat.id.toString()))) {
        // unsubscribe data when puber close
        const re = GG.getReqId((dat.id)!.toString())
        if (isErr(re)) {
            // BUG: WTF
            log.error(`${chain} parse request id error when puber closed: ${re.value}`)
            return Ok(true)
            // process.exit(2)
        }
        reqId = re.value    // the subscribe request id
        // log.info(`${chain} unsubscribe result when puber closed, fetch subscribe request ${reqId}, subscript id[${dat.id}]`)
    }

    let re = Matcher.getReqCache(reqId!)
    if (isErr(re)) {
        // 
        log.error(`${chain} get request cache error: ${re.value}, puber has been closed `)
        return Ok(true)
    }
    const req = re.value as ReqT
    if (dat.id && isUnsubOnClose(dat, isSubscribeID(dat.id.toString()))) {
        // log.debug(`set ${req.chain} pid[${req.pid}] unsubscribe request context when puber close`)
        // req.type = ReqTyp.Close   // to clear request cache
        req.params = req.subsId!
        req.originId = 0
    }
    return Ok(req)
}

function handleUnsubscribe(req: ReqT, dres: boolean): void {
    // rem subed topic, update puber.topics del submap
    // emit done event when puber.topics.size == 0
    const pubId = req.pubId
    const re = Puber.get(pubId)
    let puber
    if (isNone(re)) {
        log.error(`handle ${req.chain} pid[${req.pid}] unsubscribe error: invalid puber ${req.pubId}, may closed`)
        // process.exit(1)
    } else {
        puber = re.value as Puber
    }

    if (dres === false) {
        log.error(`${req.chain} pid[${req.pid}] puber[${pubId}] unsubscribe fail:  topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    } else {
        const subsId = req.subsId!
        let re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`unsubscribe ${req.chain} pid[${req.pid}] topic[${req.method}] id[${subsId}] error: ${re.value}, suber may closed`)
            return
        }
        const reqId = re.value
        Matcher.delReqCacheByPubStat(reqId)
        Puber.remReq(req.pubId, reqId)
        GG.remSubTopic(req.chain, req.pid, subsId)

        GG.delSubReqMap(subsId)

        if (puber !== undefined) {
            puber.topics.delete(subsId)
            Puber.updateOrAdd(puber)
            log.info(`${req.chain} pid[${req.pid}] puber[${pubId}] current topic size ${puber.topics?.size}`)
            if (puber.topics?.size === 0) {
                const evt = GG.getPuberEvent()
                evt.emit(`${pubId}-done`)
                log.info(`all topic unsubescribe of ${req.chain} pid[${req.pid}] puber[${puber.id}], emit puber clear done.`)
            }
        }
        log.info(`Puber[${pubId}] unsubscribe success: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    }
}

enum DataT {
    Ping = 'ping',
    Unsub = 'unsubscribe',
}

type DParT = {
    req?: ReqT,
    data: string | WebSocket.Data | DataT,
    withResponse?: boolean
}

function updateStatistic(req: ReqT, data: string, isSub: boolean = false): void {
    const stat = req.stat
    const bytes = Util.strBytes(data)
    if (isSub) {
        stat.reqCnt! += 1
        stat.bw! += bytes
    } else {
        if (stat.reqCnt !== undefined) {
            stat.bw! += bytes
        } else {
            stat.bw = bytes
        }
    }
    req.stat = stat
    Matcher.updateReqCache(req)
}

/// 1. rpc response: clear reqcache, replace originid 
/// 2. subscribe first response
/// 3. subscribe response non-first
/// 4. error response
/// 5. unsubscribe response
async function dataParse(data: WebSocket.Data, chain: string, subType: NodeType, subId: IDT): PResultT<DParT> {
    let dat = JSON.parse(data as string)
    // log.debug(`new ${chain} ${subType} data: %o`, dat)
    // health check message
    if (dat.id && (dat.id as string).startsWith('ping')) {
        // clear ping cache
        G.delPingCache(subId)
        // update suber status to Active
        return Ok({ data: DataT.Ping })
    }

    if (subType === NodeType.Kv) {
        if (dat.data) {
            // subscribe response
            dat = JSON.parse(dat.data)
        } else if (dat.result) {
            dat = JSON.parse(dat.result)
        }
        // dat.error: no need handle
    } 
    // else if (subType === NodeType.Mem) {
    //     // log.debug(`${chain} new memory node ws response method[${dat.method}] ID[${dat.id || dat.subscription}]: ${dat.error}`)
    // } else {
    //     // log.debug(`${chain} new node ws response method[${dat.method}] ID[${dat.id || dat.subscription}]: ${dat.error}`)
    // }

    let re: any = await parseReq(dat, chain)
    if (isErr(re)) {
        log.error(`parse ${chain} request cache error: %o`, re.value)
        return Err(`${re.value}`)
    }

    if (re.value === true) {
        // we may receive the early response of subscribe
        return Ok({ data: DataT.Unsub })
    }

    const req = re.value as ReqT
    const stat = req.stat

    if (isSecondResp(dat.params)) {
        const dats = JSON.stringify(dat)
        updateStatistic(req, dats, true)
        return Ok({ req, data: dats })
    }

    // if suber close before message event,
    // request Cache will clear before suber delete
    if (dat.error || req.type !== ReqTyp.Sub) {
        // subscribe request cache will be clear on unsubscribe event
        stat.delay = Util.traceDelay(stat.start)
        stat.bw = Util.strBytes(data.toString())
        if (dat.error) {
            log.error(`${chain} ${subType} suber get error data: %o`, dat)
            stat.code = 500
        }
        req.stat = stat
        Matcher.updateReqCache(req)
        Matcher.delReqCacheByPubStat(req.id)
        Puber.remReq(req.pubId, req.id)
    } else {
        updateStatistic(req, data.toString())
    }

    const dres = dat.result
    const isClose = isUnsubOnClose(dat, isSubscribeID(dat.id))
    dat.id = req.originId
    let dataToSend = Util.respFastStr(dat)

    if (dat.error) {
        log.error(`${req.chain} ${subType} suber of pid[${req.pid}] puber[${req.pubId}] method[${req.method}] params[${req.params}] response error: ${JSON.stringify(dat)}`)
    } else if (req.type === ReqTyp.Unsub || isClose) {
        log.info(`${chain} ${subType} suber of pid[${req.pid}] puber[${req.pubId}] method[${req.method}] params[${req.params}] unsubscribe response: ${JSON.stringify(dat)}`)
        handleUnsubscribe(req, dres)
        if (req.originId === 0) { return Ok({ req, data: DataT.Unsub }) }
    } else if (isSubRequest(req.type, isSubscribeID(dres))) {
        // first response of subscribe
        // NOTE: may receive after puber closed
        log.info(`${chain} ${subType} suber of pid[${req.pid}] puber[${req.pubId}] first subscribe method[${req.method}] params[${req.params}] response: %o`, dat)
        // check puber is closed or not
        const pubre = Puber.get(req.pubId)
        if (isNone(pubre)) {
            log.error(`${req.chain} pid[${req.pid}] puber ${req.pubId} has been closed, clear subscribe context`)
            req.subsId = dres
            Matcher.updateReqCache(req)
            // update submap
            GG.addSubReqMap(dres, req.id)

            // unsubscribe topic; clear cache
            Suber.unsubscribe(req.chain, req.subType, req.subId, req.method, dres)
            return Err(`${req.chain} pid[${req.pid}] puber ${req.pubId} has been closed`)
        }

        const subsId = dat.result

        // WTF: set suscribe context, cannot be async, will race
        re = Matcher.setSubContext(req, subsId)
        if (isErr(re)) {
            return Err(`Set subscribe context of ${req.chain} pid[${req.pid}] puber[${req.pubId}] topic[${req.method}] error: ${re.value}`)
        }

        const cache = await Dao.fetchSubscribeResponse(subsId)
        if (isSome(cache)) {
            puberSend(req, cache.value)
            // set expire duration to 1 minute, since high concurrency will
            // block the subscribe response, once receive response, clear
            Dao.clearSubscribeResponse(subsId)
        }
    } else {
        // rpc request
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({ req, data: dataToSend })
}

async function puberSend(req: ReqT, dat: WebSocket.Data): PVoidT {
    const { pubId } = req
    let re = Puber.get(pubId)
    if (isNone(re)) {
        log.error(`invalid puber ${pubId}, has been closed`)
        return
    }
    const puber = re.value as Puber
    puber.ws.send(dat)
}

function recoverPuberTopics(puber: Puber, ws: WebSocket, subType: NodeType, subId: IDT, subsId: string) {
    const { id, chain } = puber
    let re = GG.getReqId(subsId)
    if (isErr(re)) {
        log.error(`${puber.chain} pid[${puber.pid}] revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }
    const reqRe = Matcher.getReqCache(re.value)
    if (isErr(reqRe)) {
        log.error(`revocer ${puber.chain} pid[${puber.pid}] puber[${id}] subscribe topic error: ${reqRe.value}`)
        process.exit(2)
    }

    const req = reqRe.value
    if (req.subType !== subType) {
        return
    }

    // update req.subId
    req.subId = subId
    Matcher.updateReqCache(req)
    puber.topics!.delete(subsId)

    log.info(`recover ${chain} pid[${puber.pid}] new subscribe topic request: ${JSON.stringify(req)}`)
    let data: any = {
        id: req.id,
        jsonrpc: "2.0",
        method: req.method,
        params: req.params,
    }
    if (req.subType === NodeType.Kv) {
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
    log.info(`${chain} pid[${puber.pid}] recover subscribed topic[${req.method}] params[${req.params}] of puber [${id}] done`)
}

async function openHandler(chain: string, subType: NodeType, subId: IDT, ws: WebSocket, pubers: Set<IDT>) {
    log.info(`Into re-open handle chain[${chain}] ${subType} suber[${subId}] pubers: %o`, pubers)
    for (let pubId of pubers) {
        let re = Puber.get(pubId)
        if (isNone(re)) {
            log.error(`Handle re open error: invalid puber ${pubId}, may closed`)
            // remove puber
            const pubtmp = pubers
            pubtmp.delete(pubId)
            const subRe = Suber.getSuber(chain, subType, subId)
            if (isNone(subRe)) {
                log.error(`chain ${chain} ${subType} suber[${subId}] invalid`)
            } else {
                const suber = subRe.value
                suber.pubers = pubtmp
                Suber.updateOrAddSuber(chain, subType, suber)
                log.warn(`update ${chain} ${subType} suber[${subId}] pubers since puber[${pubId}] may closed when re-open`)
            }
            continue
        }
        const puber = re.value as Puber
        // update suber id
        if (subType === NodeType.Node) {
            puber.subId = subId
        } else {
            puber.kvSubId = subId
        }

        if (!puber.topics) {
            log.info(`No topics need to recover of pid[${puber.pid}] puber [${pubId}]`)
            Puber.updateOrAdd(puber)
            continue
        }
        Puber.updateOrAdd(puber)
        // re subscribe topic
        for (let subsId of puber.topics!) {
            recoverPuberTopics(puber, ws, subType, subId, subsId)
        }
        log.info(`Recoverpid[${puber.pid}]  puber[${pubId}] of ${subType} chain ${chain} done`)
    }
}

function isSuberClosed(reason: CloseReason): boolean {
    return reason === CloseReason.Kv || reason === CloseReason.Node
}

function clearNonSubReqcache(chain: string, type: NodeType, subId: IDT, pubers: Set<IDT>) {
    for (let pubId of pubers) {
        const reqIds = Puber.getReqs(pubId)
        log.info(`clear ${chain}-${type} puber[${pubId}] of suber[${subId}] non-subscribe request cache: ${reqIds.size}`)
        for (let reqId of reqIds) {
            const re = Matcher.getReqCache(reqId)
            if (isErr(re)) {
                log.error(`${chain}-${type} suber[${subId}] clear non-subscribe request cache error: %o`, re.value)
                process.exit(1)
            }
            const req = re.value
            if (req.type === ReqTyp.Sub) {
                log.debug(`${chain}-${type} suber[${subId}] ignore subscribe request cache: ${reqId}`)
                continue
            }
            Matcher.delReqCacheByPubStat(reqId)
            Puber.remReq(pubId, reqId)
        }
    }
}

function setSuberTypeCache(chain: string, type: NodeType) {
    // NOTE: all chain instances must support kv or not
    switch (type) {
        case NodeType.Kv:
            GG.setSuberEnable(chain, type, true)
            break
        case NodeType.Mem:
            GG.setSuberEnable(chain, type, true)
            break
        default:
            break
    }
}

function newSuber(chain: string, nodeId: number, url: string, type: NodeType, pubers: Set<IDT>, poolEmiter: Emiter): Suber {
    const ws = new WebSocket(url, { perMessageDeflate: false })
    let suber = { id: randomId(), ws, url, chain, nodeId, type, stat: SuberStat.Create, pubers } as Suber
    log.info(`create ${chain}-${nodeId} ${type} new suber with puber: %o`, pubers)
    Suber.updateOrAddSuber(chain, type, suber)

    ws.once('open', () => {
        poolEmiter.done()
        /// pubers may closed when re-open
        log.info(`${chain}-${nodeId} ${type} suber[${suber.id}] connection opened`)
        // GG.resetTryCnt(chain)   // reset chain connection count

        // update suber status
        let re = Suber.getSuber(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`update suber on open error: invalid suber ${suber.id} chain ${chain}-${nodeId} type ${type}`)
            process.exit(2)
        }
        const subTmp = re.value as Suber
        subTmp.stat = SuberStat.Active
        log.info(`on open ${chain}-${nodeId} ${type} suber pubers: %o`, subTmp.pubers)
        Suber.updateOrAddSuber(chain, type, subTmp)

        if (!pubers || pubers.size < 1) {
            log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} has no pubers need to recover`)
            return
        }

        // reconnect to recover matcher or subscription
        openHandler(chain, type, suber.id, ws, pubers)
    })

    ws.on('error', (err) => {
        ws.terminate()
        log.error(`${chain}-${nodeId} ${type} suber[${suber.id}] socket error: %o`, err)
    })

    /// for polkadotappjs don't handle proxy connection, it will be broken if
    /// puber connection keep alive while no message response in a certain time.
    /// we have to terminate the puber connection once suber closed
    ws.on('close', async (code: number, reason: string) => {

        /// 1. node suber: clear non-subscribe request cache, unsubscribe kv topics, clear & close pubers.
        /// 2. kv suber: unsubscribe node topics, clear & close pubers.
        log.error(`${chain}-${nodeId} ${type} suber[${suber.id}] socket closed: %o %o`, code, reason)
        const re = Suber.getSuber(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`Handle ${type} suber close event error: invalid suber ${suber.id} of chain ${chain}`)
            process.exit(1)
        }
        const subTmp = re.value as Suber
        poolEmiter?.add()
        log.debug(`get ${chain}-${nodeId} ${type} suber ${subTmp.id} pubers size: %o`, subTmp.pubers?.size)
        const isSubClose = isSuberClosed(reason as CloseReason)
        // if (isSubClose) {
        //     subTmp.stat = SuberStat.Stoped  // stop to reconnect
        // } else {
        //     subTmp.stat = SuberStat.Closed
        // }
        log.warn(`${chain}-${nodeId} ${type} suber ${subTmp.id} close reason: %o`, isSubClose ? 'brother suber closed' : 'service invalid')
        // GG.updateOrAddSuber(chain, type, subTmp)
        let pubers = new Set(subTmp.pubers) // new heap space
        // const curTryCnt = GG.getTryCnt(chain)

        // delete suber before
        Suber.delSuber(chain, type, suber.id)
        G.delPingCache(suber.id)
        log.warn(`delete ${chain}-${type} suber[${suber.id}]`)

        if (!isSubClose && pubers.size > 0) {

            // clear non-subscribe request cache  bind to suber
            clearNonSubReqcache(chain, type, subTmp.id, pubers)

            /// this tryCnt is shared by all the subers of this chain.
            /// Kv suber and Node suber maybe close at one time all both failed.
            /// Since Kv suber and Node suber is bind to the same puber, if one of 
            /// they fail we try to clear the other suber too.
            /// Specially, Kv suber is a subset of Node suber, while the Kv suber 
            /// offer the most subscribe business, we may take another strategy to 
            /// manage the suber resource.

            // const serConf = Conf.getServer()
            // if (curTryCnt >= serConf.maxReConn) {

            // make sure node service is active
            // await Util.sleep(30000)
            // log.warn(`too many try to connect to ${type} suber, clear all relate context.`)
            // clear subscribe context 
            const rea = type === NodeType.Kv ? CloseReason.Kv : CloseReason.Node
            for (let pubId of pubers) {
                // clear all topics
                let re = Puber.get(pubId)
                if (isNone(re)) {
                    log.error(`clear subscribe context when ${chain}-${nodeId} ${type} suber close error: invalid puber ${pubId}`)
                    continue
                }
                const puber = re.value
                const pid = puber.pid
                log.info(`close pid[${pid}] puber[${pubId}] of ${chain}-${nodeId} ${type} suber[${suber.id}]`)
                if (puber.topics.size < 1) {
                    log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: no topics in pid[${pid}] puber ${pubId}`)
                    // send close to puber
                    puber.ws.close(1001, rea)
                    continue
                }
                for (let subsId of puber.topics) {
                    let reid = GG.getReqId(subsId)
                    if (isErr(reid)) {
                        log.error(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: clear pid[${pid}] puber[${pubId}] subscribe context error: ${reid.value}`)
                        process.exit(2)
                    }
                    const reqId = reid.value
                    const reqr = Matcher.getReqCache(reqId)
                    if (isErr(reqr)) {
                        log.error(`clear pid[${pid}] puber ${pubId} when ${chain}-${nodeId} ${type} suber ${subTmp.id} closed error: ${reqr.value}`)
                        process.exit(2)
                    }
                    const req = reqr.value
                    if (req.subType === type) {
                        // GG.delReqCache(reqId)
                        Matcher.delReqCacheByPubStat(reqId)
                        Puber.remReq(puber.id, reqId)
                        GG.remSubTopic(chain, puber.pid, subsId)
                        GG.delSubReqMap(subsId)
                        // update puber.topic
                        puber.topics.delete(subsId)
                        log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: clear subscribe context of pid[${pid}] puber ${pubId} topic ${subsId} done`)
                    } else {
                        log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: ignore subscribe context of pid[${pid}] puber ${pubId} topic ${subsId}, is brother suber's topic`)
                    }
                }
                Puber.updateOrAdd(puber)
                puber.ws.terminate()
                G.setServerStatus(chain, type, false)
                log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: clear subscribe context of puber ${pubId} done`)
            }

            pubers = new Set<IDT>()  // clear pubers after handle 
            // GG.resetTryCnt(chain)
            log.info(`${chain}-${nodeId} ${type} suber ${subTmp.id} closed: clear context done`)
            // }    // end if (curTryCnt >= serConf.maxReConn)
        }

        // try to reconnect after 5 second
        delays(5, () => {
            log.warn(`create ${chain}-${nodeId} new ${type} suber try to connect, pubers: %o`, pubers)
            // log.warn(`create new suber try to connect ${curTryCnt + 1} times, pubers `, pubers)
            // GG.incrTryCnt(chain)
            newSuber(chain, nodeId, url, type, pubers, poolEmiter)  // poolEmiter only when start-up valid
        })
    })

    ws.on('message', async (dat: WebSocket.Data) => {
        const start = Util.traceStart()
        // BUG: if parse async, will occur message disorder problem
        let re = await dataParse(dat, chain, type, suber.id)
        const time = Util.traceEnd(start)

        if (isErr(re)) {
            log.error(`Parse ${chain}-${nodeId} ${type} suber[${suber.id}] message data error: %o`, re.value)
            return
        }
        const { data, req } = re.value
        if (data === DataT.Unsub) {
            log.info(` ${chain}-${nodeId} ${type} suber[${suber.id}] unsubscribe topic done after puber close`)
            return
        }
        if (data === DataT.Ping) {
            return
        }
        puberSend(req!, data as WebSocket.Data)
        log.info(`new ${chain}-${nodeId} ${type} suber[${suber.id}] message of [${req!.method}] id[${req!.id}] parse time[${time}]`)
    })
    return suber
}

export enum SuberStat {
    Active,
    Create,
    Closed,
    Block
}

function configCheck(chain: string, conf: ChainInstance) {
    if (conf.name !== chain) {
        log.error(`invalid config chain name ${conf.name}, right is ${chain}`)
        process.exit(1)
    }

    if (!Object.values(NodeType).includes(conf.type)) {
        log.error(`${chain} invalid type value[${conf.type}], must in %o`, Object.values(NodeType))
        process.exit(1)
    }

    if (!conf.baseUrl || !conf.wsPort) {
        log.error(`invalid ${chain} instance config: %o`, conf)
        process.exit(1)
    }
}

interface Suber {
    id: IDT,
    chain: string,
    nodeId: number,
    url: string,
    ws: WebSocket,
    type: NodeType,
    stat: SuberStat,
    pubers?: Set<IDT>,    // {pubId}
}

class Suber {

    private static g: ChainSuber = {}

    private static topic: Record<string, SubscripT> = {}

    // suber 
    static getSuber(chain: string, type: NodeType, subId: IDT): Option<Suber> {
        const ct = `${chain}-${type}`
        // log.debug(`get suber: ${Suber.g[ct]}, ${!Suber.g[ct]}, ${Suber.g[ct][subId]}, ${!Suber.g[ct][subId]}`)
        if (!Suber.g[ct] || !Suber.g[ct][subId]) {
            return None
        }
        return Some(Suber.g[ct][subId])
    }

    static getSubersByType(chain: string, type: NodeType): SuberMap {
        const ct = `${chain}-${type}`
        return Suber.g[ct] || {}
    }

    static getSubersByChain(chain: string, type: NodeType): SuberMap {
        const ct = `${chain}-${type}`
        return Suber.g[ct] || {}
    }

    static getAllSuber(): ChainSuber {
        return Suber.g
    }

    static updateOrAddSuber(chain: string, type: NodeType, suber: Suber): void {
        const ct = `${chain}-${type}`
        Suber.g[ct] = Suber.g[ct] || {}
        Suber.g[ct][suber.id] = suber
        // log.debug(`updateOradd ${chain} ${type} suber[${suber.id}] pubers: %o`, Suber.g[ct][suber.id].pubers)
    }

    static delSuber(chain: string, type: NodeType, subId: IDT): void {
        const ct = `${chain}-${type}`
        // Suber.g[ct][subId].pubers?.clear()    // BUG: will clear other  suber's pubers
        delete Suber.g[ct][subId]
        log.debug(`delete ${chain} ${type} suber[${subId}] result: %o`, Suber.g[ct][subId] === undefined)
    }

    // subscribed topic

    static getTopic(chain: string): SubscripT {
        return Suber.topic[chain]
    }

    static async selectSuber(chain: string, type: NodeType): PResultT<Suber> {

        const subers = Suber.getSubersByChain(chain, type)
        const keys = Object.keys(subers)
        if (!keys || keys.length < 1) {
            log.error(`Select suber error: no valid ${type} subers of chain ${chain} `)
            return Err(`No valid ${type} suber of chain[${chain}]`)
        }
        const ind = GG.getID() % keys.length
        const suber = subers[keys[ind]]
        if (suber.stat !== SuberStat.Active) {
            log.error(`${chain} ${type} suber is inactive`)
            return Err(`${chain} ${type} suber inactive`)
        }
        return Ok(suber)
    }

    static async initChainSuber(chain: string, suberEmiter: Emiter) {

        const ids = await Dao.getChainIds(chain)
        if (ids.length === 0) {
            log.error(`${chain} get node instance error: id list empty`)
            process.exit(1)
        }
        const chainEmiter = new Emiter(`${chain}-init`, suberEmiter.done, ids.length)

        for (let id of ids) {

            try {
                let nodeId = parseInt(id)
                const re = await Dao.getChainInstance(chain, nodeId)
                if (isErr(re)) {
                    log.error(`Config of chain[${chain}] id[${id}] invalid`)
                    process.exit(1)
                }

                const conf = re.value as ChainInstance
                configCheck(chain, conf)

                const url = `ws://${conf.baseUrl}:${conf.wsPort}`
                const type = conf.type
                const poolSize = parseInt((conf.poolSize ?? 20).toString())

                log.info(`${chain}-${id} type[${type}] url[${url}] pool size: ${poolSize}`)
                const poolEmiter = new Emiter(`${chain}-${type}-${id}-init`, () => {
                    // we may have multiple nodeId instance of type,
                    // once one of nodeId instance init done, take this type available
                    log.info(`${chain}-${type}-${id} init done`)
                    chainEmiter.done()
                    G.setServerStatus(chain, type, true)
                }, poolSize, true)

                for (let i = 0; i < poolSize; i++) {
                    // TODO: suber health listener
                    newSuber(chain, nodeId, url, type, new Set(), poolEmiter)
                }
                setSuberTypeCache(chain, type)     //e.g. kv support or not

            } catch (err) {
                log.error(`init ${chain} id[${id}] suber instance error: %o`, err)
            }
        }
    }

    static async init(emiter: Emiter) {
        // fetch chain list
        const chains = Chain.getChains()

        // config
        log.info(`NODE_ENV is ${process.env.NODE_ENV}`)
        const suberEmiter = new Emiter('suber-init', emiter.done, chains.size)

        for (let chain of chains) {
            log.info(`init suber of chain ${chain}`)
            Suber.initChainSuber(chain, suberEmiter)
        }
        log.info('Init completely.')
    }

    static async unsubscribe(chain: string, type: NodeType, subId: IDT, topic: string, subsId: string): PResultT<void> {
        /// may be closed now
        const re = Suber.getSuber(chain, type, subId)
        if (isNone(re)) {
            log.error(`get suber to unsubcribe error: invalid suber ${subId} of chain ${chain} type ${type}: may closed`)
            return Err(`suber may closed`)
        }
        const suber = re.value as Suber
        let unsubMethod = Topic.getUnsub(topic)
        let unsub: any = {
            id: subsId,   // NOTE: have to be the subscribe ID, kv need 16 bytes length
            jsonrpc: '2.0',
            method: unsubMethod,
            params: [subsId]
        }
        if (type === NodeType.Kv) {
            unsub = {
                id: subsId,
                chain: chain,
                request: JSON.stringify(unsub)
            }
        }
        suber.ws.send(Util.reqFastStr(unsub))
        log.info(`${chain} ${type} suber[${subId}] send unsubcribe topic[${unsubMethod}] id[${subsId}] `)
        return Ok(void (0))
    }

    static isSubscribeID(id: string): boolean {
        return isSubscribeID(id)
    }
}

export * from './cacher'
export * from './kver'
export * from './noder'
export * from './recorder'

export default Suber