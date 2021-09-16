/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suducer-binding map { chain: {chan: {id1: Suducer}, rpc: {id2: Suducer}}}, current choose.

import WebSocket from 'ws'
import EventEmitter from 'events'
import { getAppLogger, IDT, isErr, isNone, Option, dotenvInit } from '@elara/lib'
import { Ok, Err, PResultT } from '@elara/lib'
import { G } from './global'
import { ReqT, TopicT } from './interface'
import Dao from './dao'
import Suducer, { SuducerStat, SuducerT } from './suducer'
import Service from './service'
import { ChainConfig } from './chain'

dotenvInit()

import Conf from '../config'

const log = getAppLogger('pool')

function delays(sec: number, cb: () => void) {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

function generateUrl(url: string, port: number, sec: boolean = false) {
    let procol = 'ws://'
    if (sec) { procol = 'wss://' }
    return `${procol}${url}:${port}`
}

const rdConf = Conf.getRedis()
log.warn(`current env ${process.env.NODE_ENV} redis conf: %o`, JSON.stringify(rdConf))

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/
})()

const isSubID = (id: string): boolean => {
    return SubReg.test(id) && id.length === 16
}

type SuducerArgT = { chain: string, url: string, type: SuducerT, topic?: string }
const newSuducer = ({ chain, url, type, topic }: SuducerArgT): Suducer => {

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
            let evt = G.getPoolEvt(type)
            if (!evt) {
                log.error(`get pool event of chain ${chain} type ${type} error`)
                process.exit(2)
            }
            evt.emit(`${chain}-open`)
            log.info(`emit pool open event done of chain ${chain} type ${type}`)
        }
    })

    ws.on('error', (err: Error) => {
        log.error(`Suducer err-evt ${sign}: %o`, err)
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`Suducer close-evt ${sign}: %o %o %o`, code, reason, suducer.ws.readyState)

        if (type === SuducerT.Cache) {
            // G.delInterval(chain, CacheStrategyT.SyncAsBlock)
            let size = Conf.getServer().cachePoolSize
            if (G.getPoolCnt(chain, type) < size) {
                G.incrPoolCnt(chain, type)
            }
        }
        Pool.del(chain, type, suducer.id!)

        // set pool subscribe status fail        
        delays(3, () => Pool.add({ chain, url, type, topic }))
    })

    ws.on('message', async (data: WebSocket.Data) => {
        const dat = JSON.parse(data.toString())
        // cache data
        if (dat.id) {
            const isCacheReq = (dat.id as string).startsWith('chain')
            if (isCacheReq) {
                let pat = dat.id.split('-')
                const chain = pat[1]
                const serverId = pat[2]
                const method = pat[3]
                // 
                log.debug(`new ${chain}-${serverId} cache message: ${method}, `, dat.result)
                Dao.updateChainCache(chain, method, dat.result)
            } else if (isSubID(dat.result)) {
                // first subscribe response
                log.info(`first subscribe response chain ${chain} topic[${topic}]`)
                // G.addSubTopic(chain, dat.result, method)
                let re: any = G.getSuducerId(chain, topic!)
                if (isNone(re)) {
                    log.error(`get suducer id error: invalid chain ${chain} method ${topic}`)
                    process.exit(2)
                }
                const sudId = re.value
                re = G.getSuducer(chain, type, sudId)
                if (isNone(re)) {
                    log.error(`get suducer error: chain ${chain} type[${type}] id[${sudId}]`)
                    process.exit(2)
                }
                let suducer = re.value as Suducer
                suducer.topic = { ...suducer.topic, id: dat.result } as TopicT
                G.updateSuducer(suducer)
            }
        }
        // subscribe data
        else if (dat.params) {
            // second response
            const method = topic!

            if (method === 'state_subscribeRuntimeVersion') {
                // update syncOnce 
                log.info(`chain ${chain} runtime version update`)
                // Dao.updateChainCache(chain, method, dat.params.result)
                Service.Cacheable.syncOnceService(chain)
            }
        }
    })
    return suducer
}

async function selectSuducer(chain: string, type: SuducerT, method?: string): PResultT<Suducer> {
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

function cachePoolInit(chain: string, url: string) {
    const type = SuducerT.Cache
    const size = Conf.getServer().cachePoolSize
    G.setPoolCnt(chain, type, size)
    Pool.add({ chain, url, type })
}

function subPoolInit(chain: string, url: string) {
    const type = SuducerT.Sub
    const topics = G.getSubTopics()
    G.setPoolCnt(chain, type, Object.keys(topics).length)
    for (let topic of topics) {
        Pool.add({ chain, url, type, topic })
    }
}

class Pool {

    static add(arg: SuducerArgT) {
        let { chain, url, type, topic } = arg

        const suducer = newSuducer({ chain, url, type, topic })
        G.addSuducer(suducer)
        if (type === SuducerT.Sub) {
            G.addTopicSudid(chain, topic!, suducer.id)
        }
    }

    static del(chain: string, type: SuducerT, sudId: IDT) {
        G.delSuducer(chain, type, sudId)
        if (type === SuducerT.Sub) {
            G.delTopicSudid(chain, type)
        }
    }

    static async send(chain: string, type: SuducerT, req: ReqT) {
        // select suducer according to chain & type
        let re = await selectSuducer(chain, type, req.method)
        if (isErr(re)) {
            log.error(`select suducer error: no ${type} suducer of chain ${chain} method [${req.method}] valid`)
            process.exit(2)
        }
        const suducer = re.value as Suducer
        if (!suducer || !suducer.ws) {
            log.error(`socket has been closed: chain ${chain} type[${type}] method[${req.method}]`)
            return
        }
        suducer.ws.send(JSON.stringify(req))
        log.debug(`chain ${chain} type ${type} send new request: ${JSON.stringify(req)} `)
    }

    static isSuducerOk(suducer: Suducer): boolean {
        return suducer.stat === SuducerStat.Active
    }

    static init(secure: boolean = false) {
        // init pool for basic sub & chan connection
        const cconf = G.getAllChainConfs()
        const re = G.getAllChains()

        if (isNone(cconf) || isNone(re)) {
            log.error(`no chains available`)
            return
        }
        const chains = re.value
        const chainConf = cconf.value
        G.setPoolEvt(SuducerT.Sub, new EventEmitter())
        G.setPoolEvt(SuducerT.Cache, new EventEmitter())

        for (let chain of chains) {
            const conf = chainConf[chain] as ChainConfig

            const url = generateUrl(conf.baseUrl, conf.wsPort, secure)

            cachePoolInit(chain, url)

            subPoolInit(chain, url)
        }
    }
}

export default Pool