import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { ReqT, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, isOk, IDT, Err, Ok, ResultT } from 'lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'
import Puber from './puber'

const log = getAppLogger('suber', true)

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
    log.warn('new suber message data: ', dat)
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
        // clear request cache
        G.delReqCache(req.id)
    }
}

const newSuber = (chain: string, url: string): Suber => {
    const ws = new WebSocket(url)
    const suber =  { id: randomId(), ws, url, chain }

    ws.once('open', () => {
        log.info(`Websocket connection open: chain[${chain}]`)
        // reconnect to recover matcher or subscription
    })

    ws.on('error', (err) => {
        log.error(`${chain} socket error: `, err)
        // TODO
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`${chain} socket closed: `, code, reason)
        // TODO
        // 1. clear suber & matcher
        // 2. cache matcher config
        // 3. rematche puber -> suber & re subscribe the topics
        // reconnect 
        ws.close()

        delays(3, () => newSuber(chain, url))
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
                const suber = newSuber(c, url)
                G.updateAddSuber(c, suber)
            }
        }
        log.info('Init completely. ', G.getAllSubers())
    }
}

export default Suber


/**
 * TODO
 * 1. puber error & close event: Done
 * 2. suber topic and mathcer bind: Done
 * 3. suber close: short & long handle logic
 */