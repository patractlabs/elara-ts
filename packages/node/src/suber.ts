import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { ReqT, SubscripT, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, IDT, Err, Ok, ResultT, PVoidT } from 'lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'
import Puber from './puber'

const log = getAppLogger('suber', true)
const MAX_RE_CONN_CNT = 10

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const subReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const dataParse = (dat: WsData): ResultT => {
    let reqId: IDT
    // log.warn('new suber message data: ', dat)
    if (dat.id) {
        // request response or subscription respond first time 
        reqId = dat.id

        if (dat.result === true || dat.result === false) {
            log.info('Unsubscribe result: ', dat.result)
        }
        // handle method cache
        let re = G.getReqCache(reqId)  
        if (isErr(re)) {
            log.error('Get request cache error: ', re.value)
            return Err(`message parse error: ${re.value}`)
        }
        const req = re.value as ReqT
        const subsId = dat.result
        const subTestOk: boolean = subReg.test(subsId)

        if (req.isSubscribe && subTestOk) {
            re = Matcher.setSubContext(req, subsId)

            if (isErr(re)) {
                log.error(`update puber[${req.pubId}] topics error: `, re.value)
                return Err(`update puber[${req.pubId}] topics error: ${re.value}`)
            }
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
const puberSend = (pubId: IDT, dat: WsData) => {

    let re = G.getPuber(pubId)

    if (isErr(re)) {
        if (dat.result === true || dat.result == false) {
            log.warn('Unscribe response: ', dat.result)
        } else {
            log.error('Invalid puber: ', re.value)
        }
        return
    }
    const puber = re.value as Puber
    puber.ws.send(JSON.stringify(dat))
}

const msgCb = (data: WebSocket.Data) => {
    const dat = JSON.parse(data.toString())
    let re = dataParse(dat)
    if (isErr(re)) {
        log.error('Parse message data error: ', re.value)
        return
    }
    const reqId = re.value as IDT
    re = G.getReqCache(reqId)
    if (isErr(re)) {
        log.error('Get request cache error: ', re.value)
        return
    }
    const req = re.value as ReqT
    dat.id = req.originId
    puberSend(req.pubId, dat)
    if (!req.isSubscribe) {
        // subscribe request cache will be clear 
        // on close or unsubscribe event
        G.delReqCache(req.id)
    }
}

const puberClear = (pubers: IDT[]) => {
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

        // clear request cache & sub map & subed topics 
        // ReqMap have to be clear before subMap
        const topics = puber.topics || []
        for (let subsId of topics) {
            G.remSubTopic(puber.chain, puber.pid, subsId)
            // no need to unsubscribe
            let re = G.getReqId(subsId)
            if (isErr(re)) {
                log.error(`clear subscribe topic on suber close error: `, re.value)
                continue
            }
            const reqId = re.value as IDT
            G.delReqCache(reqId)
            G.delSubReqMap(subsId)
        }

        // delete puber
        G.delPuber(pubId)
    }
}

const closeHandler = async (chain: string, suber: Suber): PVoidT => {

    log.warn(`Too many reconnection try of chain[${chain}], start to clear resource.`)
    // clear pubers context
    puberClear(suber.pubers || [])

}

const recoverPuber = (pubId: IDT, subId: IDT): ResultT => {
    let re = G.getPuber(pubId)
    if (isErr(re)) { return re }

    const puber = re.value as Puber

    // rematche subId
    puber.subId = subId
    G.addPuber(puber)
    
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

const openHandler = (chain: string, subId: IDT, ws: WebSocket, pubers: IDT[]) => {
    for (let pubId of pubers) {

        let re = recoverPuber(pubId, subId)
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
        }
    }
}

const newSuber = (chain: string, url: string, pubers?: IDT[]): Suber => {
    const ws = new WebSocket(url)
    const suber =  { id: randomId(), ws, url, chain, pubers } as Suber
    G.updateAddSuber(chain, suber)

    ws.once('open', () => {
        log.info(`Websocket connection open: chain[${chain}]`)

        // reset RE_CONN_CNT = 0 
        G.resetConnCnt(chain)

        // reconnect to recover matcher or subscription
        if (!pubers) {
            log.warn('No pubers to recover!')
            return 
        }

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
        let pubers = subTmp.pubers
        log.warn(`Ready to create new suber, transmit pubers: `, pubers)

        if (G.getConnCnt(chain) >= MAX_RE_CONN_CNT) {
            await closeHandler(chain, subTmp)
            pubers = []
        }
        G.delSuber(chain, suber.id)
        // try to reconnect
        delays(3, () => {
            log.warn(`create new suber try to connect`)
            newSuber(chain, url, pubers || [])
            G.incrConnCnt(chain)
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
    pubers?: IDT[]    // [pubId]
}

namespace Suber {

    export const selectSuber = (chain: string): ResultT => {
    
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

    export const init = async () => {
        // fetch chain list
        await Chain.init()
        const chains = G.getChains()
        // config
        const poolSize = 2

        for (let c of chains) {
            const conf = await Dao.getChainConfig(c)
            if (isErr(conf)) { 
                log.warn(`Config of chain[${c}] invalid`)    
                continue 
            }
            const url = geneUrl(conf.value)
            log.info(`Url of chain [${c}] is: `, url)
            for (let i = 0; i < poolSize; i++) {                
                newSuber(c, url)
            }
        }
        log.info('Init completely. ', G.getAllSubers())
    }
}

export default Suber