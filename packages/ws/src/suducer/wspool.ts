/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suber-binding map { chain: {chan: {id1: Suber}, rpc: {id2: Suber}}}, current choose.

import WebSocket from 'ws'
import { getAppLogger, IDT, Kafka } from 'lib'
import { G } from './global'
import { Suber, SuberType, SuberPool, 
    newSuber, ChainStat, SubStat, WsPool,
    SubProto
} from './interface'
import { SubMethod } from 'lib'
import Dao from '../dao'
import { Service } from '.'
import Mq from './kafka'

const log = getAppLogger('suber-p', true)


const lowCase = (str: string) => {
    return str.toLowerCase()
}

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

const getSuber = (chain: string, type: SuberType, suberId?: IDT): Suber => {
    const pool = G.cpool[lowCase(chain)][type]
    if (suberId) {
        return pool![suberId] as Suber
    }
    let selected = Object.keys(pool!)[0]
    // strategy
    // TODO
    for (let _id in pool) {
        // select one
        break
    }
    return pool![selected] as Suber
}

const getPool = (chain: string, type: SuberType): SuberPool => {
    const c = G.cpool[lowCase(chain)]
    if (c && c[type]) {
        return c[type] as SuberPool
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

const createSuber = (chain: string, url: string, type: SuberType, cb: (data: any) => void) => {

    // TODO: need to close the suber or unsubscribe when 
    // something unexpected occured
    const ws: WebSocket = new WebSocket(url)
    let suber: Suber = newSuber({chain, url, type, ws})
    const sign = `Chain[${chain}]-Url[${url}]-Type[${type}]-ID[${suber.id}]`
    // 
    ws.once('open', () => {
        log.info(`${sign} opened`)
        // set the status ok
        suber.chainStat = ChainStat.Health  
        suber.stat = SubStat.Active
        // re subscribe  according to sub status      
        log.warn('G cpool status: ', G.cpool[chain][type]!['status'] )  
        if (type === SuberType.Sub && G.cpool[chain][type]!['status'] === 'death') {
            log.warn('Rescribe the topics')
            G.cpool[chain][type]!['status'] = 'active'
            // 
            Service.Subscr.subscribeService(chain)
            log.warn('after re subscribe: ', G.cpool)
        }
    })
 
    ws.on('error', (err: Error) => {
        // TODO
        // what kind of error will occur?
        // Cannot create new suber here, stack overflow.
        log.error(`Suber err-evt ${sign}: `, err)
    })


    // BUG: will create another connection
    ws.on('close', (code: number, reason: string) => {
        log.error(`Suber close-evt ${sign}: `, code, reason, suber.ws.readyState)

        Pool.del(chain, type, suber.id!)
        // set pool subscribe status fail        
        log.warn('Pool state after del: ', G.cpool)
        delays(3, () => Pool.add(chain, url, type))
    })

    ws.on('message', cb)

    return suber
}

namespace Pool {

    export const add = (chain: string, url: string, type: SuberType) => {
        chain = lowCase(chain)
        let cb = cacheMsgListener(chain)
        if (type === SuberType.Sub) {
            cb = subMsgListener(chain)
        }

        const suber = createSuber(chain, url, type, cb)
        let spool: SuberPool = {}
        spool[suber.id!] = suber
        // if (type === SuberType.Sub) {
        //     spool['status'] = ''
        // }
        let wpool: WsPool = {}
        let cpool = G.cpool[chain]
        wpool[type] = {...(cpool && cpool[type]) || {}, ...spool}
        // log.info('cpool before: ', cpool)
        G.cpool[chain] = {...cpool, ...wpool}
        // log.info(`Add suber [${chain}] [${type}] [${suber.id}] [${suber.chainId}]: `, G.cpool)
    }
    
    export const del = (chain: string, type: SuberType, subId: IDT) => {
        // TODO
        let spool = getPool(chain, type)
        delete spool[subId]
        if (type === SuberType.Sub) {
            spool['status'] = 'death'
        }
    }

    export const delChain = (chain: string) => {
        delete G.cpool[lowCase(chain)]
    }
    
    // TODO
    export const send = (chain: string, type: SuberType, req: string) => {
        const spool = getPool(chain, type)
        // strategy to select a suber
        const ids = Object.keys(spool)
        log.warn('Into pool send: ', chain, type, req)
        if (!spool || ids.length < 1 || (ids.length === 1 && ids[0] === 'status')) {
            log.error('No invalid suber pool', ids)
            return
        }
        // select a valid suber, if none, export error
        let suber: Suber = {} as Suber
        for (let i of ids) {
            if (i === 'status') { continue }
            suber = spool[i] as Suber
        }

        // const suber = spool[ids[0]] as Suber
        // if (!isSuberOk(suber)) {
        //     log.error('Suber is not active!')
        // }
        suber.ws.send(req)
    }

    export const isSuberOk = (suber: Suber): boolean => {
        return suber.stat === SubStat.Active && suber.chainStat === ChainStat.Health
    }

    export const init = (secure: boolean = false) => {
        // init pool for basic sub & chan connection
        const cconf = G.chainConf
        for (let chain in cconf) {
            const conf = cconf[chain]
            const url = generateUrl(conf.baseUrl, conf.wsPort, secure)
            add(chain, url, SuberType.Cache)
            add(chain, url, SuberType.Sub)
            add(chain, url, SuberType.Reqresp)
        }
    }
}

export = Pool