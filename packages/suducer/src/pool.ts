/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suducer-binding map { chain: {chan: {id1: Suducer}, rpc: {id2: Suducer}}}, current choose.

import WebSocket from 'ws'
import EventEmitter from 'events'
import { ChainConfig, getAppLogger, IDT, isErr, isNone, Option } from 'lib'
import { Ok, Err, PResultT  } from 'lib'
import { G } from './global'
import { SubProto, ReqT, TopicT } from './interface'
import Dao from './dao'
import Suducer, { SuducerStat, SuducerT } from './suducer'
import Mq from './mq'

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

// const subMsgListener = (chain: string) => {
//     // update redis cache
//     const subMap: any = SubMethod
//     log.info('Sub method map: ', subMap)
//     return (msg: any) => {
//         const dat = JSON.parse(msg)
//         // log.warn('parse data: ', dat)
//         if (dat.result && dat.id) {
//             // first time return subscription result
//             // update subscription id according to id
//             // Method_chain_id: method
//             log.info('Subscribe id is: ', dat.result)

//         } else if (dat.params) {
//             const re = dat.params.result
//             const subId = dat.params.subscription
//             const method = subMap[dat.method]
//             log.warn('data method: ', dat.method)
//             log.info(`Get chain[${chain}] ${method}-${subId} subscription data: `, re)
//             // notify Matcher

//             if (method === 'state_subscribeRuntimeVersion') {
//                 // update syncOnce data
//                 log.warn(`${chain} runtime version update`)
//                 Service.Cache.syncOnceService(chain)
//             }

//             // produce subscribe result msg
//             // chain, topic, group, data 
//             // msg wrap
//             const prot = buildSubProto(chain, method, re, dat.params.subscription)
//             const partition = Kafka.geneID()
//             const msg = Kafka.newMsg(prot, 'sub')   
//             const topic = Kafka.newTopic(chain, method)

//             // TODO
//             Mq.producer.send({
//                 topic,
//                 messages: [msg],
//             }).then(re => {
//                 log.warn('send kafka result: ', re)
//             }).catch(err => {
//                 log.error('send kafka error: ', err)
//             })
//             log.warn('send kafka message: ', topic, msg)
//         }
//     }
// }

const msgCb = (data: WebSocket.Data) => {
    const dat = JSON.parse(data.toString())
    log.warn('new data')
}

type SuducerArgT = {chain: string, url: string, type: SuducerT, topic?: string}
const newSuducer = ({chain, url, type, topic}: SuducerArgT): Suducer => {

    const ws: WebSocket = new WebSocket(url)
    let top
    if (type === SuducerT.Sub) {
        top = {
            topic,
            params: []
        } as TopicT
    }
    let suducer: Suducer = Suducer.create(chain, type, ws, url, top)
    // log.info(`create new suducer: ${JSON.stringify(suducer)}`)
    const sign = `Chain[${chain}]-Url[${url}]-Type[${type}]-ID[${suducer.id}]`
    
    ws.once('open', () => {
        log.info(`Suducer ${sign} opened`)

        // set the status ok
        suducer.stat = SuducerStat.Active
        G.updateSuducer(suducer)

        // decr pool cnt
        G.decrPoolCnt(chain, type)
        if (G.getPoolCnt(chain, type) === 0) {
            // emit init done event
            let evt = G.getPoolEvt(chain, type)
            if (!evt) {
                log.error(`get pool event of chain ${chain} type ${type} error`)
                process.exit(2)
            }
            evt.emit('done')
            log.info(`emit pool event done of chain ${chain} type ${type}`)
        }
    })
 
    ws.on('error', (err: Error) => {
        log.error(`Suducer err-evt ${sign}: `, err)
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`Suducer close-evt ${sign}: `, code, reason, suducer.ws.readyState)
        // keep the topic try to recover

        Pool.del(chain, type, suducer.id!)
        G.delSuducer(chain, type, suducer.id)
        // set pool subscribe status fail        
        log.warn('Pool state after del: ', G.cpool)
        delays(3, () => Pool.add({chain, url, type, topic}))
    })

    ws.on('message', (data: WebSocket.Data) => {
        const dat = JSON.parse(data.toString())
        log.warn(`new data of chain ${chain} type ${type} topic ${topic}: ${data}`)
    })

    return suducer
}

namespace Pool {

    export const add = (arg: SuducerArgT) => {
        let {chain, url, type, topic} = arg
        // // message listen
        // let cb = cacheMsgListener(chain)
        // if (type === SuducerT.Sub) {
        //     cb = subMsgListener(chain)
        // }

        const suducer = newSuducer({chain, url, type, topic})
        G.addSuducer(suducer)
        if (type === SuducerT.Sub) {
            G.addTopicSudid(chain, topic!, suducer.id)
        }
     }
    
    export const del = (chain: string, type: SuducerT, sudId: IDT) => {
        G.delSuducer(chain, type, sudId)
        if (type === SuducerT.Sub) {
            G.delTOpicSudid(chain, type)
        }
    }

    const selectSuducer = async (chain: string, type: SuducerT, method?: string): PResultT => {
        let suducer: Suducer

        if (type === SuducerT.Cache) {
            let re = G.getSuducers(chain, type)
            if (isNone(re)) {
                return Err(`no suducer of chain ${chain} type ${type}`)
            }
            // TODO: robin 
            const suducers = re.value
            suducer = suducers[Object.keys(suducers)[0]]
        } else if (type === SuducerT.Sub) {
            let re: Option<any> = G.getSuducerId(chain, method!)
            if (isNone(re)) {
                return Err(`no suducer id of chain ${chain} topic[${method}]`)
            }

            re = G.getSuducer(chain, type, re.value) 
            if (isNone(re)) {
                return Err(`no suducer of chain ${chain} type ${type}`)
            }
            suducer = re.value
        } else {
            return Err(`no this suducer of type ${type}`)
        }
        return Ok(suducer)
    }
    
    export const send = async (chain: string, type: SuducerT, req: ReqT) => {
        // select suducer according to chain & type
        let re = await selectSuducer(chain, type, req.method)
        if (isErr(re)) {
            log.error(`select suducer error: no ${type} suducer of chain ${chain} method [${req.method}] valid`)
            process.exit(2)
        }
        const suducer = re.value as Suducer
        suducer.ws.send(JSON.stringify(req))
        log.info(`chain ${chain} type ${type} send new request: ${JSON.stringify(req)} `)
    }

    export const isSuducerOk = (suducer: Suducer): boolean => {
        return suducer.stat === SuducerStat.Active
    }

    const cachePoolInit = (chain: string, url: string) => {
        const type = SuducerT.Cache
        G.setPoolEvt(chain, type, new EventEmitter())
        G.setPoolCnt(chain, type, 1)
        add({chain, url, type})
    }

    const subPoolInit = (chain: string, url: string) => {
        const type = SuducerT.Sub
        const topics = G.getSubTopics()
        G.setPoolCnt(chain, type, Object.keys(topics).length)
        G.setPoolEvt(chain, type, new EventEmitter())
        for (let topic of topics) {
            add({chain, url, type, topic})
        }
    }

    export const init = (secure: boolean = false) => {
        // init pool for basic sub & chan connection
        const cconf = G.getAllChainConfs()
        const re = G.getAllChains()

        if (isNone(cconf) || isNone(re)) {
            log.error(`no chains available`)
            return
        }
        const chains = re.value
        const chainConf = cconf.value
        for (let chain of chains) {
            const conf = chainConf[chain] as ChainConfig

            const url = generateUrl(conf.baseUrl, conf.wsPort, secure)

            cachePoolInit(chain, url)

            subPoolInit(chain, url)
        }
    }
}

export = Pool