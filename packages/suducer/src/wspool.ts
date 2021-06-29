/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suducer-binding map { chain: {chan: {id1: Suducer}, rpc: {id2: Suducer}}}, current choose.

import WebSocket from 'ws'
import { getAppLogger, IDT, isNone, Kafka } from 'lib'
import { G } from './global'
import { SuducerPool, ChainStat, WsPool, SubProto } from './interface'
import { SubMethod } from 'lib'
import Dao from './dao'
import Service  from './service'
import Mq from './mq/kafka'
import Suducer, { SuducerStat, SuducerT } from './suducer'

const log = getAppLogger('Suducer-pool', true)

const lowCase = (str: string) => {
    return str.toLowerCase()
}

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const getPool = (chain: string, type: SuducerT): SuducerPool => {
    const c = G.cpool[lowCase(chain)]
    if (c && c[type]) {
        return c[type] as SuducerPool
    }
    return {}
}

const generateUrl = (url: string, port: number, sec: boolean = false) => {
    let procol = 'ws://'
    if (sec) { procol = 'wss://'}
    return `${procol}${url}:${port}`
}

const cacheMsgListener = (chain: string) => {

    return  (msg: any) => {
        const dat = JSON.parse(msg)
        const method = G.idMethod[dat.id]
        // log.info('data: ', dat, method, G.idMethod)
        if (method) {
            delete G.idMethod[dat.id]
            // cache H_[method]_[chain] { updateTime: 2021-0525, data: "{any}"}
            Dao.updateChainCache(chain, method, JSON.stringify(dat.result))
        } else {
            log.error('No this method: ', method)
        }
    }
}

/// kafka

const buildSubProto = (chain: string, topic: string, data: any, subId: IDT): SubProto => {
    return {
        chain,
        topic,
        subId,
        data
    } 
}

const subMsgListener = (chain: string) => {
    // update redis cache
    const subMap: any = SubMethod
    log.info('Sub method map: ', subMap)
    return (msg: any) => {
        const dat = JSON.parse(msg)
        // log.warn('parse data: ', dat)
        if (dat.result && dat.id) {
            // first time return subscription result
            // update subscription id according to id
            // Method_chain_id: method
            log.info('Subscribe id is: ', dat.result)

        } else if (dat.params) {
            const re = dat.params.result
            const subId = dat.params.subscription
            const method = subMap[dat.method]
            log.warn('data method: ', dat.method)
            log.info(`Get chain[${chain}] ${method}-${subId} subscription data: `, re)
            // notify Matcher

            if (method === 'state_subscribeRuntimeVersion') {
                // update syncOnce data
                log.warn(`${chain} runtime version update`)
                Service.Cache.syncOnceService(chain)
            }

            // produce subscribe result msg
            // chain, topic, group, data 
            // msg wrap
            const prot = buildSubProto(chain, method, re, dat.params.subscription)
            const partition = Kafka.geneID()
            const msg = Kafka.newMsg(prot, 'sub')   
            const topic = Kafka.newTopic(chain, method)
            Mq.producer.send({
                topic,
                messages: [msg],
            }).then(re => {
                log.warn('send kafka result: ', re)
            }).catch(err => {
                log.error('send kafka error: ', err)
            })
            log.warn('send kafka message: ', topic, msg)
        }
    }
}

const reqrespMsgListener = (chain: string) => {
    return (msg: any) => {
        log.info('Req&Resp message: ', chain)
    }
}

const newSuducer = (chain: string, url: string, type: SuducerT, cb: (data: any) => void): Suducer => {

    // TODO: need to close the Suducer or unsubscribe when 
    // something unexpected occured
    const ws: WebSocket = new WebSocket(url)
    let suducer: Suducer = Suducer.create(chain, type, ws, url)
    const sign = `Chain[${chain}]-Url[${url}]-Type[${type}]-ID[${suducer.id}]`
    // 
    ws.once('open', () => {
        log.info(`Suducer ${sign} opened`)
        // set the status ok
        suducer.stat = SuducerStat.Active
        G.updateSuducer(suducer)

        // re subscribe  according to sub status      
        log.warn('G cpool status: ', G.cpool[chain][type]!['status'] )  
        if (type === SuducerT.Sub && G.cpool[chain][type]!['status'] === 'death') {
            log.warn('Rescribe the topics')
            G.cpool[chain][type]!['status'] = 'active'
            // 
            Service.Subscr.subscribeService(chain)
            log.warn('after re subscribe: ', G.cpool)
        }
    })
 
    ws.on('error', (err: Error) => {
        log.error(`Suducer err-evt ${sign}: `, err)
    })


    // BUG: will create another connection
    ws.on('close', (code: number, reason: string) => {
        log.error(`Suducer close-evt ${sign}: `, code, reason, suducer.ws.readyState)

        Pool.del(chain, type, suducer.id!)
        // set pool subscribe status fail        
        log.warn('Pool state after del: ', G.cpool)
        delays(3, () => Pool.add(chain, url, type))
    })

    ws.on('message', cb)

    return suducer
}

namespace Pool {

    export const add = (chain: string, url: string, type: SuducerT) => {
        chain = lowCase(chain)
        let cb = cacheMsgListener(chain)
        if (type === SuducerT.Sub) {
            cb = subMsgListener(chain)
        }

        const suducer = newSuducer(chain, url, type, cb)
        let spool: SuducerPool = {}
        spool[suducer.id!] = suducer
        // if (type === SuducerT.Sub) {
        //     spool['status'] = ''
        // }
        let wpool: WsPool = {}
        let cpool = G.cpool[chain]
        wpool[type] = {...(cpool && cpool[type]) || {}, ...spool}
        // log.info('cpool before: ', cpool)
        G.cpool[chain] = {...cpool, ...wpool}
        // log.info(`Add Suducer [${chain}] [${type}] [${Suducer.id}] [${Suducer.chainId}]: `, G.cpool)
    }
    
    export const del = (chain: string, type: SuducerT, subId: IDT) => {
        // TODO
        let spool = getPool(chain, type)
        delete spool[subId]
        if (type === SuducerT.Sub) {
            spool['status'] = 'death'
        }
    }

    export const delChain = (chain: string) => {
        delete G.cpool[lowCase(chain)]
    }
    
    // TODO
    export const send = (chain: string, type: SuducerT, req: string) => {
        const spool = getPool(chain, type)
        // strategy to select a Suducer
        const ids = Object.keys(spool)
        log.warn('Into pool send: ', chain, type, req)
        if (!spool || ids.length < 1 || (ids.length === 1 && ids[0] === 'status')) {
            log.error('No invalid Suducer pool', ids)
            return
        }
        // select a valid Suducer, if none, export error
        let Suducer: Suducer = {} as Suducer
        for (let i of ids) {
            if (i === 'status') { continue }
            Suducer = spool[i] as Suducer
        }

        // const Suducer = spool[ids[0]] as Suducer
        // if (!isSuducerOk(Suducer)) {
        //     log.error('Suducer is not active!')
        // }
        Suducer.ws.send(req)
    }

    export const isSuducerOk = (suducer: Suducer): boolean => {
        // Suducer.stat === SuducerStat.Active &&
        // return Suducer.chainStat === ChainStat.Health
        return suducer.stat === SuducerStat.Active
    }

    export const init = (secure: boolean = false) => {
        // init pool for basic sub & chan connection
        const cconf = G.getAllChains()
        if (isNone(cconf)) {
            log.error(`no chains available`)
            return
        }
        const chains = cconf.value
        for (let chain in chains) {
            const conf = chains[chain]
            const url = generateUrl(conf.baseUrl, conf.wsPort, secure)
            add(chain, url, SuducerT.Cache)
            add(chain, url, SuducerT.Sub)
            add(chain, url, SuducerT.Reqresp)
        }
    }
}

export = Pool