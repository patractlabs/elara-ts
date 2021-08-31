import { randomId } from '@elara/lib'
import WebSocket from 'ws'
import { ReqT, ReqTyp, WsData, CloseReason, ChainSuber, SuberMap, SubscripT } from '../interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PResultT, isNone, Option, Some, None } from '@elara/lib'
import GG from '../global'
import Chain from '../chain'
import Dao from '../dao'
import Matcher from '.'
import Puber from '../puber'
import Conf from '../../config'
import Util from '../util'
import Topic from './topic'
import G from '../global'

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
    // log.debug(`test subscribe ID [${id}]`)
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

function parseReq(dat: WsData, chain: string): ResultT<ReqT | boolean> {
    let reqId = dat.id // maybe null

    if (dat.id === null) {
        log.error(`Unexcepted ${chain} response null id: ${dat}`)
        return Err(`${chain} null id response: ${dat}`)
    }

    if (isSecondResp(dat.params)) {
        const subsId = dat.params.subscription
        log.info(`${chain} receive second response of subscribe: %o`, subsId)
        const re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`${chain} parse request cache error: ${re.value}, puber has been closed.`)
            return Ok(true)
        }
        reqId = re.value
    } else if (isUnsubOnClose(dat, isSubscribeID(dat.id.toString()))) {
        // unsubscribe data when puber close
        log.warn(`${chain} get unsubscribe resposne when puber close: %o`, dat)
        const re = GG.getReqId((dat.id)!.toString())
        if (isErr(re)) {
            log.error(`${chain} parse request id error when puber closed: ${re.value}`)
            process.exit(2)
        }
        reqId = re.value    // the subscribe request id
        log.info(`${chain} unsubscribe result when puber closed, fetch subscribe request ${reqId}`)
    }

    let re = GG.getReqCache(reqId!)
    if (isErr(re)) {
        // 
        log.error(`${chain} get request cache error: ${re.value}, puber has been closed `)
        return Ok(true)
    }
    const req = re.value as ReqT
    if (dat.id && isUnsubOnClose(dat, isSubscribeID(dat.id.toString()))) {
        log.info(`set ${req.chain} pid[${req.pid}] unsubscribe request context when puber close`)
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
    const re = Puber.get(req.pubId)
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
        log.debug(`unsubscribe ${req.chain} pid[${req.pid}] subsid params: %o %o`, req.subsId, req.params)
        const subsId = req.subsId!
        let re = GG.getReqId(subsId)
        if (isErr(re)) {
            log.error(`unsubscribe ${req.chain} pid[${req.pid}] topic[${req.method}] id[${subsId}] error: ${re.value}, suber may closed`)
            return
        }
        const reqId = re.value
        GG.delReqCacheByPubStatis(reqId)

        GG.remSubTopic(req.chain, req.pid, subsId)

        GG.delSubReqMap(subsId)
        log.info(`clear ${req.chain} pid[${req.pid}] subscribe context cache: subsId[${subsId}] reqId[${reqId}]`)

        if (puber !== undefined) {
            puber.topics.delete(subsId)
            Puber.updateOrAdd(puber)
            log.info(`${req.chain} pid[${req.pid}] current topic size ${puber.topics?.size}, has event: ${puber.event !== undefined} of puber[${puber.id}]`)
            if (puber.topics?.size === 0 && puber.event) {
                puber.event?.emit('done')
                log.info(`all topic unsubescribe of ${req.chain} pid[${req.pid}] puber[${puber.id}], emit puber clear done.`)
            }
        }
        log.info(`Puber[${pubId}] unsubscribe success: chain[${req.chain}] pid[${req.pid}] topic[${req.method}] params[${req.params}] id[${req.subsId}]`)
    }
}

type DParT = {
    req: ReqT,
    data: string | WebSocket.Data | boolean
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
    G.updateReqCache(req)
}

/// 1. rpc response: clear reqcache, replace originid 
/// 2. subscribe first response
/// 3. subscribe response non-first
/// 4. error response
/// 5. unsubscribe response
function dataParse(data: WebSocket.Data, chain: string, subType: SuberTyp): ResultT<DParT> {
    let dat = JSON.parse(data as string)
    if (subType === SuberTyp.Kv) {
        if (dat.data) {
            // subscribe response
            dat = JSON.parse(dat.data)
        } else if (dat.result) {
            dat = JSON.parse(dat.result)
        }
        // dat.error: no need handle
        log.info(`${chain} new kv ws response method[${dat.method}] ID[${dat.id || dat.subscription}]: ${dat.error}`)
    } else {
        log.info(`${chain} new node ws response method[${dat.method}] ID[${dat.id || dat.subscription}]: ${dat.error}`)
    }
    // NOTE: if asynclize parseReqId, 
    // subReqMap may uninit, then miss the first data response
    let re: any = parseReq(dat, chain)
    if (isErr(re)) {
        log.error(`parse ${chain} request cache error: %o`, re.value)
        return Err(`${re.value}`)
    }
    if (re.value === true) {
        return Ok({ req: {} as ReqT, data: true })
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
        if (dat.error) { stat.code = 500 }
        req.stat = stat
        GG.updateReqCache(req)
        GG.delReqCacheByPubStatis(req.id)
        log.info(`delete ${req.chain} pid[${req.pid}] non-subscribe cache request ID[${req.id}]: %o`, req.method)
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
        if (req.originId === 0) { return Ok({ req, data: true }) }
    } else if (isSubRequest(req.type, isSubscribeID(dres))) {
        // first response of subscribe
        // NOTE: may receive after puber closed
        log.info(`${chain} ${subType} suber of pid[${req.pid}] puber[${req.pubId}] first subscribe method[${req.method}] params[${req.params}] response: %o`, dat)
        // check puber is closed or not
        const pubre = Puber.get(req.pubId)
        if (isNone(pubre)) {
            log.error(`${req.chain} pid[${req.pid}] puber ${req.pubId} has been closed, clear subscribe context`)
            req.subsId = dres
            GG.updateReqCache(req)
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
        log.info(`${req.chain} pid[${req.pid}] puber[${req.pubId}] subscribe topic[${req.method}] params[${req.params}] successfully: ${subsId}`)
    } else {
        // rpc request
        log.info(`New web socket response ${req.chain} pid[${req.pid}] puber[${req.pubId}] method[${req.method}] params[${req.params}]`)
        dataToSend = JSON.stringify(dat)    // 
    }
    return Ok({ req, data: dataToSend })
}

function puberSend(pubId: IDT, dat: WebSocket.Data) {
    let re = Puber.get(pubId)
    if (isNone(re)) {
        log.error(`invalid puber ${pubId}, has been closed`)
        return
    }
    const puber = re.value as Puber
    puber.ws.send(dat)
    log.debug(`${puber.chain} pid[${puber.pid}] puber ${pubId} send response `)
}

function recoverPuberTopics(puber: Puber, ws: WebSocket, subType: SuberTyp, subId: IDT, subsId: string) {
    const { id, chain } = puber
    let re = GG.getReqId(subsId)
    if (isErr(re)) {
        log.error(`${puber.chain} pid[${puber.pid}] revocer puber[${id}] subscribe topic error: ${re.value}`)
        process.exit(2)
    }
    const reqRe = GG.getReqCache(re.value)
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
    GG.updateReqCache(req)
    puber.topics!.delete(subsId)

    log.info(`recover ${chain} pid[${puber.pid}] new subscribe topic request: ${JSON.stringify(req)}`)
    let data: any = {
        id: req.id,
        jsonrpc: "2.0",
        method: req.method,
        params: req.params,
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
    log.info(`${chain} pid[${puber.pid}] recover subscribed topic[${req.method}] params[${req.params}] of puber [${id}] done`)
}

async function openHandler(chain: string, subType: SuberTyp, subId: IDT, ws: WebSocket, pubers: Set<IDT>) {
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
        if (subType === SuberTyp.Node) {
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

function clearNonSubReqcache(subId: IDT) {
    // TODO: by suber & puber
    const reqs = GG.getAllReqCache()
    log.debug(`clear non subscribe request cache: ${Object.keys(reqs).length}`)
    for (let reqId in reqs) {
        const req = reqs[reqId]
        if (req.subId === subId && req.type !== ReqTyp.Sub) {
            GG.delReqCacheByPubStatis(reqId)
            log.info(`clear ${req.chain} pid[${req.pid}] non-subscribe request cache: ${reqId} of suber ${req.subId}`)
        }
    }
}

function newSuber(chain: string, url: string, type: SuberTyp, pubers?: Set<IDT>): Suber {
    const ws = new WebSocket(url, { perMessageDeflate: false })
    let suber = { id: randomId(), ws, url, chain, type, stat: SuberStat.Create, pubers } as Suber
    log.info(`create ${chain} ${type} new suber with puber: %o`, pubers)
    Suber.updateOrAddSuber(chain, type, suber)
    ws.once('open', () => {
        /// pubers may closed when re-open
        log.info(`${chain} ${type} suber[${suber.id}] connection opened`)

        // GG.resetTryCnt(chain)   // reset chain connection count

        // update suber status
        let re = Suber.getSuber(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`update suber on open error: invalid suber ${suber.id} chain ${chain} type ${type}`)
            process.exit(2)
        }
        const subTmp = re.value as Suber
        subTmp.stat = SuberStat.Active
        log.debug(`on open ${chain} ${type} suber pubers: %o`, subTmp.pubers)
        Suber.updateOrAddSuber(chain, type, subTmp)

        if (!pubers || pubers.size < 1) {
            log.info(`${chain} ${type} suber ${subTmp.id} has no pubers need to recover`)
            return
        }

        // reconnect to recover matcher or subscription
        openHandler(chain, type, suber.id, ws, pubers)
    })

    ws.on('error', (err) => {
        log.error(`${chain} ${type} suber[${suber.id}] socket error: %o`, err)
        // suber.ws.close()
    })

    ws.on('close', async (code: number, reason: string) => {
        log.error(`${chain} ${type} suber[${suber.id}] socket closed: %o %o`, code, reason)
        const re = Suber.getSuber(chain, type, suber.id)
        if (isNone(re)) {
            log.error(`Handle ${type} suber close event error: invalid suber ${suber.id} of chain ${chain}`)
            process.exit(1)
        }
        const subTmp = re.value as Suber
        log.debug(`get ${type} suber ${subTmp.id} pubers size: %o`, subTmp.pubers?.size)
        const isSubClose = isSuberClosed(reason as CloseReason)
        // if (isSubClose) {
        //     subTmp.stat = SuberStat.Stoped  // stop to reconnect
        // } else {
        //     subTmp.stat = SuberStat.Closed
        // }
        log.warn(`chain ${chain} ${type} suber ${subTmp.id} close reason: %o`, isSubClose ? 'brother suber closed' : 'service invalid')
        // GG.updateOrAddSuber(chain, type, subTmp)
        let pubers = new Set(subTmp.pubers) // new heap space
        // const curTryCnt = GG.getTryCnt(chain)
        if (!isSubClose && pubers.size > 0) {
            // clear non-subscribe request cache  bind to suber
            clearNonSubReqcache(subTmp.id)

            /// this tryCnt is shared by all the subers of this chain.
            /// Kv suber and Node suber maybe close at one time all both failed.
            /// Since Kv suber and Node suber is bind to the same puber, if one of 
            /// they fail we try to clear the other suber too.
            /// Specially, Kv suber is a subset of Node suber, while the Kv suber 
            /// offer the most subscribe business, we may take another strategy to 
            /// manage the suber resource.

            // const serConf = Conf.getServer()
            // if (curTryCnt >= serConf.maxReConn) {
            if (true) {
                // make sure node service is active
                await Util.sleep(30000)
                // log.warn(`too many try to connect to ${type} suber, clear all relate context.`)
                // clear subscribe context 
                const rea = type === SuberTyp.Kv ? CloseReason.Kv : CloseReason.Node
                for (let pubId of pubers) {
                    // clear all topics
                    let re = Puber.get(pubId)
                    if (isNone(re)) {
                        log.error(`clear subscribe context when ${chain} ${type} suber close error: invalid puber ${pubId}`)
                        continue
                    }
                    const puber = re.value
                    const pid = puber.pid
                    log.info(`close pid[${pid}] puber[${pubId}] of ${chain} ${type} suber[${suber.id}]`)
                    if (puber.topics.size < 1) {
                        log.info(`${chain} ${type} suber ${subTmp.id} closed: no topics in pid[${pid}] puber ${pubId}`)
                        // send close to puber
                        puber.ws.close(1001, rea)
                        continue
                    }
                    for (let subsId of puber.topics) {
                        let reid = GG.getReqId(subsId)
                        if (isErr(reid)) {
                            log.error(`${chain} ${type} suber ${subTmp.id} closed: clear pid[${pid}] puber[${pubId}] subscribe context error: ${reid.value}`)
                            process.exit(2)
                        }
                        const reqId = reid.value
                        const reqr = GG.getReqCache(reqId)
                        if (isErr(reqr)) {
                            log.error(`clear pid[${pid}] puber ${pubId} when ${chain} ${type} suber ${subTmp.id} closed error: ${reqr.value}`)
                            process.exit(2)
                        }
                        const req = reqr.value
                        if (req.subType === type) {
                            // GG.delReqCache(reqId)
                            GG.delReqCacheByPubStatis(reqId)
                            GG.remSubTopic(chain, puber.pid, subsId)
                            GG.delSubReqMap(subsId)
                            // update puber.topic
                            puber.topics.delete(subsId)
                            log.info(`${chain} ${type} suber ${subTmp.id} closed: clear subscribe context of pid[${pid}] puber ${pubId} topic ${subsId} done`)
                        } else {
                            log.info(`${chain} ${type} suber ${subTmp.id} closed: ignore subscribe context of pid[${pid}] puber ${pubId} topic ${subsId}, is brother suber's topic`)
                        }
                    }
                    Puber.updateOrAdd(puber)
                    puber.ws.terminate()
                    log.info(`${chain} ${type} suber ${subTmp.id} closed: clear subscribe context of puber ${pubId} done`)
                }

                pubers = new Set<IDT>()  // clear pubers after handle 
                // GG.resetTryCnt(chain)
                log.info(`${chain} ${type} suber ${subTmp.id} closed: clear context done`)
            }
        }

        // delete suber before
        Suber.delSuber(chain, type, suber.id)
        // try to reconnect after 5 second
        delays(5, () => {
            log.warn(`create ${chain} new ${type} suber try to connect, pubers: %o`, pubers)
            // log.warn(`create new suber try to connect ${curTryCnt + 1} times, pubers `, pubers)
            newSuber(chain, url, type, pubers)
            // GG.incrTryCnt(chain)
        })
    })

    ws.on('message', (dat: WebSocket.Data) => {
        const start = Util.traceStart()
        let re = dataParse(dat, chain, type)
        const time = Util.traceEnd(start)

        if (isErr(re)) {
            log.error(`Parse ${chain} ${type} suber[${suber.id}] message data error: %o`, re.value)
            return
        }
        if (re.value.data === true) {
            log.info(`unsubscribe topic done after ${chain} ${type} suber[${suber.id}] close`)
            return
        }
        const { data, req } = re.value
        puberSend(req.pubId, data as WebSocket.Data)
        log.info(`new ${chain} ${type} suber[${suber.id}] message of [${req.method}] parse time[${time}]`)
    })
    return suber
}

function geneUrl(conf: ChainConfig): string[] {
    let res = [`ws://${conf.baseUrl}:${conf.wsPort}`]

    if (conf.kvEnable && conf.kvEnable.toString() === 'true') {
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
    Closed,
    Stoped
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

class Suber {

    private static g: ChainSuber = {}

    private static topic: Record<string, SubscripT> = {}

    // suber 
    static getSuber(chain: string, type: SuberTyp, subId: IDT): Option<Suber> {
        const ct = `${chain}-${type}`
        // log.debug(`get suber: ${Suber.g[ct]}, ${!Suber.g[ct]}, ${Suber.g[ct][subId]}, ${!Suber.g[ct][subId]}`)
        if (!Suber.g[ct] || !Suber.g[ct][subId]) {
            return None
        }
        return Some(Suber.g[ct][subId])
    }

    static getSubersByChain(chain: string, type: SuberTyp,): SuberMap {
        const ct = `${chain}-${type}`
        return Suber.g[ct] || {}
    }

    static getAllSuber(): ChainSuber {
        return Suber.g
    }

    static updateOrAddSuber(chain: string, type: SuberTyp, suber: Suber): void {
        const ct = `${chain}-${type}`
        Suber.g[ct] = Suber.g[ct] || {}
        Suber.g[ct][suber.id] = suber
        // log.debug(`updateOradd ${chain} ${type} suber[${suber.id}] pubers: %o`, Suber.g[ct][suber.id].pubers)
    }

    static delSuber(chain: string, type: SuberTyp, subId: IDT): void {
        const ct = `${chain}-${type}`
        // Suber.g[ct][subId].pubers?.clear()    // BUG: will clear other  suber's pubers
        delete Suber.g[ct][subId]
        log.debug(`delete ${chain} ${type} suber[${subId}] result: %o`, Suber.g[ct][subId] === undefined)
    }

    // subscribed topic

    static getTopic(chain: string): SubscripT {
        return Suber.topic[chain]
    }

    static async selectSuber(chain: string, type: SuberTyp): PResultT<Suber> {

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

    static async initChainSuber(chain: string, poolSize: number) {
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
            if ((conf.kvEnable.toString()) === 'true') {
                log.debug(`chain ${chain} kv subscribe enable: %o`, conf.kvEnable)
                newSuber(chain, urls[1], SuberTyp.Kv, new Set())
            }
        }
    }

    static async init() {
        // fetch chain list
        const chains = Chain.getChains()

        // config
        const wsConf = Conf.getWsPool()
        log.info(`NODE_ENV is ${process.env.NODE_ENV}, pool size ${wsConf.poolSize}`)
        for (let chain of chains) {
            log.info(`init suber of chain ${chain}`)
            Suber.initChainSuber(chain, wsConf.poolSize)
        }
        log.info('Init completely.')
    }

    static async unsubscribe(chain: string, type: SuberTyp, subId: IDT, topic: string, subsId: string): PResultT<void> {
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
        if (type === SuberTyp.Kv) {
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

export default Suber