import { randomId } from 'lib/utils'
import WebSocket from 'ws'
import { Puber, Suber, SubscripT, WsData } from './interface'
import { ChainConfig, getAppLogger, isErr, isOk, IDT, Err, Ok, ResultT } from 'lib'
import G from './global'
import Chain from './chain'
import Dao from './dao'
import Matcher from './matcher'

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
    let pubId: IDT
    if (dat.id) {
        pubId = dat.id
        log.info('data result: ', dat.result)
        const subTestOk: boolean = subReg.test(dat.result)
        // handle method cache
        let re = G.getMethodCache(pubId)  // maybe conflic, 
        if (isOk(re) && subTestOk) {
            const sub = re.value as SubscripT
            G.addSubscription(dat.result, pubId)

            // update matcher 
            sub.id = dat.result     // result is subscribe ID
            sub.pubId = pubId
            Matcher.addSubscribe(pubId, sub.id!)
            // delete method cache
            G.delMethodCache(pubId)
            // add subscribed record
            re = G.getPuber(pubId)
            if (isErr(re)) {
                // SBH
                log.error()
                return re
            }
            const puber = re.value as Puber
            G.addSubTopic(puber.chain, puber.pid, sub)
            log.warn('Update sub topic: ', Matcher.get(pubId))
        }
        // if (subTestOk) {
        //     G.addSubscription(dat.result, dat.id)
        // }
    } else if (dat.params) {
        const subsId = dat.params.subscription
        const re = G.getSubscription(subsId)
        if (isErr(re)) {
            log.error('Subscribe message parse error: ', re.value)
            return Err(`SubCache invalid,subscription id [${subsId}]`)
        }
        pubId = re.value
    } else {
        return Err(`Unknow error`)
    }
    return Ok(pubId) 
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
    // get origin ID
    re = Matcher.getOriginId(puber.id)
    if (isErr(re)) {
        log.error('Get origin id error: ', re.value)
        //TODO: clear this matcher, realloc
        return
    }
    const oriId = re.value as IDT
    dat.id = oriId  // recover id bind
    puber.ws.send(JSON.stringify(dat))
}

const msgCb = (data: WebSocket.Data) => {
    const dat = JSON.parse(data.toString())
    let re = dataParse(dat)
    if (isErr(re)) {
        log.error('Parse message data error: ', re.value)
        return
    }
    const pubId = re.value as IDT
    puberSend(pubId, dat)
}

const newSuber = (chain: string, url: string): Suber => {
    const ws = new WebSocket(url)

    ws.once('open', () => {
        log.info(`Websocket connection open: chain[${chain}]`)
        // reconnect to recover matcher or subscription
    })

    ws.on('error', (err) => {
        log.error(`${chain} socket error: `, err)
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`${chain} socket closed: `, code, reason)
    
        // reconnect 
        delays(3, () => newSuber(chain, url))
    })

    ws.on('message', msgCb)

    return { id: randomId(), ws, url, chain }
}

const geneUrl = (conf: ChainConfig) => {
    return `ws://${conf.baseUrl}:${conf.wsPort}`
}

namespace Suber {

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
            G.addSuber(c, suber)
        }
    }
    log.info('Init completely. ', G.getAllSubers())
}
}

export default Suber


/**
 * TODO
 * 1. error & close event
 * 2. suber topic and mathcer bind
 * 3. 
 */