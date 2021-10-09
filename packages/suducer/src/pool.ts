/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suducer-binding map { chain: {chan: {id1: Suducer}, rpc: {id2: Suducer}}}, current choose.

import WebSocket from 'ws'
import { getAppLogger, IDT, isErr, isNone, Option, dotenvInit } from '@elara/lib'
import { Ok, Err, PResultT } from '@elara/lib'
import { G } from './global'
import { ReqT, TopicT } from './interface'
import Dao from './dao'
import Suducer, { SuducerStat, SuducerT } from './suducer'
import Service from './service'
import Conf from '../config'
import Emiter from './emiter'

dotenvInit()


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

interface SuducerArgT {
    chain: string,
    nodeId: string,
    url: string,
    type: SuducerT,
    topic?: string
}

const newSuducer = (emiter: Emiter, { chain, nodeId, url, type, topic }: SuducerArgT): Suducer => {

    const ws: WebSocket = new WebSocket(url)
    let top
    if (type === SuducerT.Sub) {
        top = {
            topic,
            params: []
        } as TopicT
    }
    let suducer: Suducer = Suducer.create(chain, nodeId, type, ws, url, top)
    const sign = `Chain[${chain}]-${nodeId}-Url[${url}]-Type[${type}]-ID[${suducer.id}]`

    ws.on('open', () => {
        log.info(`Suducer ${sign} opened`)
        emiter.done()
        // set the status ok
        suducer.stat = SuducerStat.Active
        G.updateSuducer(suducer)
    })

    ws.on('error', (err: Error) => {
        log.error(`Suducer err-evt ${sign}: %o`, err)
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`Suducer close-evt ${sign}: %o %o %o`, code, reason, suducer.ws.readyState)
        emiter.add()

        Pool.del(chain, nodeId, type, suducer.id!)

        // set pool subscribe status fail        
        delays(3, () => Pool.add(emiter, { chain, nodeId, url, type, topic }))
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
                log.info(`first subscribe response chain ${chain}-${nodeId} topic[${topic}]`)
                // G.addSubTopic(chain, dat.result, method)
                let re: any = G.getSuducerId(chain, topic!)
                if (isNone(re)) {
                    log.error(`get suducer id error: invalid chain ${chain}-${nodeId} method ${topic}`)
                    process.exit(2)
                }
                const sudId = re.value
                re = G.getSuducer(chain, nodeId, type, sudId)
                if (isNone(re)) {
                    log.error(`get suducer error: chain ${chain}-${nodeId} type[${type}] id[${sudId}]`)
                    process.exit(2)
                }
                let suducer = re.value as Suducer
                suducer.topic = { ...suducer.topic, id: dat.result } as TopicT
                G.updateSuducer(suducer)
            }
        } else if (dat.params) {
            // second response
            const method = topic!

            if (method === 'state_subscribeRuntimeVersion') {
                // update syncOnce 
                log.warn(`chain ${chain}-${nodeId} runtime version update`)
                // Dao.updateChainCache(chain, method, dat.params.result)
                Service.Cacheable.syncOnceService(chain, nodeId)
            }
        }
    })
    return suducer
}

async function selectSuducer(chain: string, nodeId: string, type: SuducerT, method?: string): PResultT<Suducer> {
    let suducer: Suducer

    if (type === SuducerT.Cache) {
        let re = G.getSuducers(chain, nodeId, type)
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

        re = G.getSuducer(chain, nodeId, type, re.value)
        if (isNone(re)) {
            return Err(`no suducer of chain ${chain} type ${type}`)
        }
        suducer = re.value
    } else {
        return Err(`no this suducer of type ${type}`)
    }
    return Ok(suducer)
}

function cachePoolInit(chain: string, nodeId: string, url: string, emiter: Emiter) {
    const type = SuducerT.Cache
    const size = Conf.getServer().cachePoolSize
    const suducerEmiter = new Emiter(`suducer-${nodeId}-${type}`, emiter.done, size, true)
    for (let i = 0; i < size; i++) {
        Pool.add(suducerEmiter, { chain, nodeId, url, type })
    }
}

function subPoolInit(chain: string, nodeId: string, url: string, emiter: Emiter) {
    const type = SuducerT.Sub
    const topics = G.getSubTopics()
    const size = Object.keys(topics).length
    const suducerEmiter = new Emiter(`suducer-${nodeId}-${type}`, () => {
        emiter.done()
        Service.Subscribe.subscribeService(chain, nodeId)
        // Service.Cacheable.syncOnceService(chain, nodeId)
    }, size, true)

    for (let topic of topics) {
        log.debug(`init ${chain}-${nodeId} subscribe pool of topic: ${topic}`)
        Pool.add(suducerEmiter, { chain, nodeId, url, type, topic })
    }
}

class Pool {

    static add(emiter: Emiter, arg: SuducerArgT) {
        let { chain, nodeId, url, type, topic } = arg

        const suducer = newSuducer(emiter, { chain, nodeId, url, type, topic })
        G.addSuducer(suducer)
        if (type === SuducerT.Sub) {
            G.addTopicSudid(chain, topic!, suducer.id)
        }
    }

    static del(chain: string, nodeId: string, type: SuducerT, sudId: IDT) {
        G.delSuducer(chain, nodeId, type, sudId)
        if (type === SuducerT.Sub) {
            G.delTopicSudid(chain, type)
        }
    }

    static async send(chain: string, nodeId: string, type: SuducerT, req: ReqT) {
        // select suducer according to chain & type
        let re = await selectSuducer(chain, nodeId, type, req.method)
        if (isErr(re)) {
            log.error(`select suducer error: no ${type} suducer of chain ${chain}-${nodeId} method [${req.method}] valid`)
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

    static init(doneListener: (args: any[]) => void, secure: boolean = false) {
        // init pool for basic sub & chan connection
        const re = G.getAllChains()
        if (isNone(re)) {
            log.error(`no chains available`)
            return
        }
        const chains = re.value

        const chainEmiter = new Emiter('chain-init', doneListener, chains.length)
        for (let chain of chains) {
            const { name, nodeId, baseUrl, wsPort } = chain
            const url = generateUrl(baseUrl, wsPort, secure)
            const poolEmiter = new Emiter(`${name}-${nodeId}-init`, chainEmiter.done, 2)

            cachePoolInit(name, nodeId, url, poolEmiter)
            subPoolInit(name, nodeId, url, poolEmiter)
        }
    }
}

export default Pool