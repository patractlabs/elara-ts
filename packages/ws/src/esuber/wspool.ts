/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suber-binding map { chain: {chan: {id1: Suber}, rpc: {id2: Suber}}}, current choose.

import WebSocket from 'ws'
import { getAppLogger, IDT } from 'lib'
import { G } from './global'
import { Suber, SuberType, SuberPool, newSuber, ChainStat, SubStat, WsPool } from './interface'
import { SubMethod } from 'lib'
import Rd from '../db/redis'

const log = getAppLogger('suber-p', true)

enum PoolStrategy {
    Robin,
}

const excuter = []

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
        return pool![suberId]
    }
    let selected = Object.keys(pool!)[0]
    // strategy
    // TODO
    for (let _id in pool) {
        // select one
        break
    }
    return pool![selected]
}

const getPool = (chain: string, type: SuberType): SuberPool => {
    // if ()
    return G.cpool[lowCase(chain)][type] || {}
}

const generateUrl = (url: string, port: number, sec: boolean = false) => {
    let procol = 'ws://'
    if (sec) { procol = 'wss://'}
    return `${procol}${url}:${port}`
}

const chanMsg = (chain: string) => {

    return  (msg: any) => {
        const dat = JSON.parse(msg)
        // according to id cache result
        Rd.getRpcMethod(chain, dat.id).then(method => {
            // log.info('data: ', msg, method)
            if (method) {
                Rd.delRpcMethod(chain, dat.id)
                Rd.setLatest(chain, method, JSON.stringify(dat.result))
            } else {
                log.error('No this method: ', method)
            }
        }).catch(e => {
            log.error('Rpc channel message listen error: ', e)
        })
    }
}

const subMsg = (chain: string) => {
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
            // cache result, H_[method]_[chain] { updateTime: 2021-0525, data: "{balala}"}
            // notify Matcher

        }
     
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
    })
 
    ws.on('error', (err: Error) => {
        // TODO
        // what kind of error will occur?
        // Cannot create new suber here, stack overflow.
        log.error(`Suber err-evt ${sign}: `, err)
    })

    ws.on('close', (code: number, reason: string) => {
        log.error(`Suber close-evt ${sign}: `, code, reason)

        suber.ws.close()
        Pool.del(chain, type, suber.id!)
        log.warn('pool: ',chain, type, suber.id, G.cpool)
        delays(3, () => Pool.add(chain, url, type))
    })

    ws.on('message', cb)

    return suber
}

namespace Pool {

    export const add = (chain: string, url: string, type: SuberType) => {
        chain = lowCase(chain)
        let cb = chanMsg(chain)
        if (type === SuberType.Sub) {
            cb = subMsg(chain)
        }

        const suber = createSuber(chain, url, type, cb)
        let spool: SuberPool = {}
        spool[suber.id!] = suber
        let wpool: WsPool = {}
        let cpool = G.cpool[chain]
        wpool[type] = {...(cpool && cpool[type]) || {}, ...spool}
        log.info('cpool before: ', cpool)
        G.cpool[chain] = {...cpool, ...wpool}
        log.info(`Add suber [${chain}] [${type}] [${suber.id}] [${suber.chainId}]: `, G.cpool)
    }
    
    export const del = (chain: string, type: SuberType, subId: IDT) => {
        // TODO
        let spool = getPool(chain, type)
        delete spool[subId]
    }

    export const delChain = (chain: string) => {
        delete G.cpool[lowCase(chain)]
    }
    
    export const send = (chain: string, type: SuberType, req: any) => {
        const spool = getPool(chain, type)
        // strategy to select a suber
        // TODO
        const ids = Object.keys(spool)
        if (!spool || ids.length < 1) {
            log.error('No invalid suber pool')
            return
        }
        // select a valid suber, if none, export error
        const suber = spool[ids[0]]
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
        // fetch chain config
        const cconf = G.chainConf
        for (let chain in cconf) {
            const conf = cconf[chain]
            const url = generateUrl(conf.baseUrl, conf.wsPort, secure)
            add(chain, url, SuberType.Chan)
            add(chain, url, SuberType.Sub)
        }

        // for test
        setTimeout(() => {
            for (let c in G.cpool) {
                // log.warn('new suber state: ', G.cpool[c])
            }
        }, 1000);
    }

    // according to the request and pool config
    // upgrade the pool resource
    const upgrade = () => {
        // TODO
        // add connection
    }
}

export = Pool