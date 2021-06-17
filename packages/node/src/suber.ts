import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { ReqT, SubscripT, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PVoidT, PResultT } from 'lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'
import Puber from './puber'
import Conf from '../config'
import Util from './util'
// import Assert from 'assert'

const log = getAppLogger('suber', true)
const MAX_RE_CONN_CNT = 10

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const dataParse = async (dat: WsData): PResultT => {
    let reqId: IDT
    log.warn('new suber message data: ', dat)
    if (dat.id) {
        // request response or subscription respond first time 
        reqId = dat.id

        if (dat.result === true || dat.result === false) {
            log.warn('Unsubcribe result is ok?: ', dat.result)
        }
        // handle method cache
        let re = G.getReqCache(reqId)  
        if (isErr(re)) {
            log.error('Get request cache error: ', re.value)
            return Err(`message parse error: ${re.value}`)
        }
        const req = re.value as ReqT
        const subsId = dat.result
        const subTestOk: boolean = SubReg.test(subsId)

        if (req.isSubscribe && subTestOk) {
            let tc = G.topicCnt()
            // let ptc = G.puberTopicCnt(req.pubId)
            log.warn(`${reqId} all topic cnt: `, tc)
            Puber.updateTopics(req.pubId, subsId)
            // let cptc = G.puberTopicCnt(req.pubId)
            // log.warn('puber topic cnt: ', ptc, cptc)
            // Assert.strictEqual(cptc, ptc + 1)
            // set suscribe context, cannot be async, will race
            re = Matcher.setSubContext(req, subsId)

            if (isErr(re)) {
                log.error(`update puber[${req.pubId}] topics error: `, re.value)
                return Err(`update puber[${req.pubId}] topics error: ${re.value}`)
            }
            // let ctc = G.topicCnt()
            // log.warn(`${reqId} all topic cnt after add new topic: `, ctc)

            // Assert.strictEqual(ctc, tc + 1)
            log.info(`Puber[${req.pubId}] subscribe topic[${req.method}] params[${req.params}] successfully: ${subsId}`)
        }
    } else if (dat.params) {
        // subscription response 
        const subsId = dat.params.subscription
        const re = G.getReqId(subsId)
        if (isErr(re)) {
            log.error('Get request ID error: ', re.value)
            return Err(`SubReqMap invalid,subscription id [${subsId}]`)
        }
        reqId = re.value as IDT
    } else {
        return Err(`Unknow error`)
    }
    return Ok(reqId) 
}

// send the message back to puber
const puberSend = async (pubId: IDT, dat: WsData) => {

    let re = G.getPuber(pubId)
    log.warn('puber send data: ', dat)
    if (isErr(re)) {
        log.error('Invalid puber: ', re.value)
        return
    }
    const puber = re.value as Puber
    puber.ws.send(JSON.stringify(dat))
}

const msgCb = async (data: WebSocket.Data) => {
    const dat = JSON.parse(data.toString())
    let re = await dataParse(dat)
    if (isErr(re)) {
        log.error('Parse message data error: ', re.value)
        return
    }
    // test log
    Util.logGlobalStat()

    const reqId = re.value as IDT
    re = G.getReqCache(reqId)
    if (isErr(re)) {
        log.error('Get request cache error: ', re.value)
        return
    }
    const req = re.value as ReqT
    dat.id = req.originId
    puberSend(req.pubId, dat)
    /// if suber close before message event,
    /// this request Cache will clear before suber delete
    if (!req.isSubscribe) {
        // subscribe request cache will be clear 
        // on close or unsubscribe event
        G.delReqCache(req.id)
    }
}

const puberClear = async (pubers: Set<IDT>) => {
    log.warn(`Into puber clear: `, pubers)
    for (let pubId of pubers) {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            // SBH
            log.error(`clear puber on suber close error: `, re.value)
            continue
        }
        // close puber conn
        const puber = re.value as Puber   
        puber.ws.close(1001, 'cannot connect to server')
    }
}

const closeHandler = async (chain: string, suber: Suber): PVoidT => {

    log.warn(`Too many reconnection try of chain[${chain}], start to clear resource.`)
    // clear pubers context
    puberClear(suber.pubers || new Set<IDT>())

}

const recoverPuber = async (pubId: IDT, subId: IDT): PResultT => {
    let re = G.getPuber(pubId)
    if (isErr(re)) { return re }

    const puber = re.value as Puber

    // rematche subId
    puber.subId = subId
    G.updateAddPuber(puber)
    
    if (!puber.topics) { return Err('No topics to recover') }
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
    return re
}

const openHandler = async (chain: string, subId: IDT, ws: WebSocket, pubers: Set<IDT>) => {
    log.warn(`Into re-open handle chain[${chain}] suber[${subId}] pubers[${pubers}]`)
    for (let pubId of pubers) {

        let re = await recoverPuber(pubId, subId)
        if (isErr(re)) {
            log.error(`Handle re open error: `, re.value)
            continue
        }
        const puber = re.value as Puber

        // re subscribe topic
        for (let subsId of puber.topics!) {

            let re = recoverSubedTopic(chain, puber.pid, subsId)
            if (isErr(re)) {
                log.error(`Handle re open error: `, re.value)
                continue
            }
            const subtopic = re.value as SubscripT
            log.warn('Get subed topic: ', subtopic)
            // send subscribe
            re = G.getReqId(subsId)
            if (isErr(re)) {
                log.error(`Handle re open error: `, re.value)
                continue
            }
            
            // update req cache
            re = G.getReqCache(re.value)
            if (isErr(re)) {
                // SBH
                log.error(`Handle re open error: `, re.value)
                continue
            }
            const req = re.value as ReqT
                
            let params = []
            if (subtopic.params !== 'none') {
                params = JSON.parse(subtopic.params)
            }
            ws.send(JSON.stringify({
                id: req.id, 
                jsonrpc: "2.0", 
                method: subtopic.method, 
                params,
            }))

            // delete topic subed
            G.remSubTopic(chain, puber.pid, subsId)

            // delete subMap
            G.delSubReqMap(subsId)

            // no need to clear req cache, 
            // req.subsId will be update after new message received
        }
    }
}

const reqCacheClear = async (pubers: Set<IDT>) => {
    const reqs = G.getAllReqCache()
    for (let reqId in reqs) {
        if (pubers.has(reqs[reqId].pubId)) {
            G.delReqCache(reqId)
        }
    }
}

const newSuber = (chain: string, url: string, pubers?: Set<IDT>): Suber => {
    // chain valid check
    Dao.getChainConfig(chain)
    const ws = new WebSocket(url, { perMessageDeflate: false })
    const suber =  { id: randomId(), ws, url, chain, pubers } as Suber
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
        log.error(`${chain} socket error: `, err)
        suber.ws.close()
    })

    ws.on('close', async (code: number, reason: string) => {
        log.error(`${chain} socket closed: `, code, reason)

        const re = G.getSuber(chain, suber.id)
        if (isErr(re)) {
            log.error(`Handle suber close event error: `, re.value)
            return
        }
        const subTmp = re.value as Suber
        let pubers = subTmp.pubers || new Set<IDT>()
        log.warn(`Ready to create new suber, transmit pubers: `, pubers)

        if (G.getTryCnt(chain) >= MAX_RE_CONN_CNT) {
            // clear all the puber resource
            await closeHandler(chain, subTmp)
            pubers = new Set<IDT>()  // clear pubers after handle done
        }
        // try to clear request cache of suber.pubers before delete,
        // which wont clear on subscribe request cache
        reqCacheClear(pubers)
        
        // delete suber before

        G.delSuber(chain, suber.id)

        // try to reconnect
        delays(3, () => {
            log.warn(`create new suber try to connect`)
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
        log.warn('Select the suber: ', ind, keys[ind])
        return Ok(subers[keys[ind]])
    }

    export const initChainSuber = async (chain: string, poolSize: number) => {
        const conf = await Dao.getChainConfig(chain)
        if (isErr(conf)) { 
            log.warn(`Config of chain[${chain}] invalid`)    
            return 
        }
        const url = geneUrl(conf.value)
        log.info(`Url of chain [${chain}] is: `, url)
        for (let i = 0; i < poolSize; i++) {                
            newSuber(chain, url)
        }
    }

    export const init = async () => {
        // fetch chain list
        await Chain.init()
        const chains = G.getChains()
        // config
        const wsConf = Conf.getWs()
        log.warn('Pool size: ', wsConf.poolSize, process.env.NODE_ENV)
        for (let c of chains) {
            initChainSuber(c, wsConf.poolSize)
        }
        log.info('Init completely. ', G.getAllSubers())
    }
}

export default Suber