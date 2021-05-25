/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
/// TODO: SyncAsBlock is ovelap with the subscription
import WebSocket from 'ws'
import { ChainConfig, getAppLogger, RpcStrategy } from 'lib'
import { newSuber, Suber } from './interface'
import { G } from './global'
import { chainInit } from './chain'

const log = getAppLogger('esuber', true)


type OnMsgCb = (this: WebSocket, data: WebSocket.Data) => void
type OnErrCb = (this: WebSocket, err: Error) => void

const createSuber = (chain: string, url: string, cb: OnMsgCb, options?: Suber) => {

    // TODO: need to close the suber or unsubscribe when 
    // something unexpected occured
    const ws: WebSocket = new WebSocket(url)
    ws.on('open', () => {
        log.info('Open connection to Polkadot node ws', options)
        const sub = newSuber({chain, url, ws, ...options})
        G.cpool[chain].sub.push(sub)
        log.info('suber: ', G.cpool)
        sub.ws.send(JSON.stringify(buildReq('system_health', [])))
    })
 
    ws.on('error', (err: any) => {
        log.error(`Suber[${chain}]-${G.cpool[chain].sub[0].cluster} Connect error: `, err)
    })

    ws.on('message', cb)
}

const generateUrl = (url: string, port: number, sec: boolean = false) => {
    let procol = 'ws://'
    if (sec) { procol = 'wss://'}
    return `${procol}${url}:${port}`
}

export const poolInit = (secure: boolean) => {
    const chains = G.chains
    for (let c of chains) {
        const cconf: ChainConfig = G.chainConf[c]
        const url = generateUrl(cconf.baseUrl, cconf.wsPort, secure)
        let suber = createSuber(c, url, () =>{
            
        })
    }
}


// init resource
export const setup = async (url: string) => {
    // init a ws connection for all chains
    let chain = 'Polkadot'
    await chainInit()
    log.info('G chains: ', G.chains)
    createSuber(chain, url, (data: any) => {
        log.info(`Suber[${chain}]-${G.cpool[chain].sub[0].cluster} received node ws data: `, data)
        // TODO: cache data
    })
    // createSuber('Polkadot', url, {"stat": SubStat.Check})

    
}

const getExclude = (chain: string): string[] => {
    return G.chainExt[chain]['excludes']
}

const buildReq = (method: string, params: any[]) => {
    return {
        "id": 1,
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    }
}

/// according to rpc strategy modulize the service
/// SyncAsBlock, SyncLow, SyncOnce, Subscribe, Kv, Abandon, Direct
/// all the service follow the step, 
///     1. get base rpc methods
///     2. extends and excludes
///     3. request & cache 
/// except the scheduler [SyncAsBlock, SyncLow], scheduler has a dynamic
/// config, request the active list
///     1. init scheduler
///     2. fetch the active chains
///     3. follow the above steps

const syncAsBlockService = async (chain: string) => {
    let interval = setInterval(() => {

    }, 5 * 1000)
    G.intervals.push(interval)
}

const syncLowService = (chain: string) => {
    let interval = setInterval(() => {
        // read register list
        // dispatch
    }, 10 * 60 * 1000)
}

// no parameters allowed
const syncOnceHandler = (chain: string, method: string, params: any[] = []) => {
    const req = buildReq(method, params)
    G.ws[chain].ws.send(JSON.stringify(req))
    // onMessageListener will cache
}

const syncOnceService = (chain: string) => {
    let brpcs = G.rpcs.SyncOnce
    let excludes = getExclude(chain)
    
    log.info('rpcs: ', brpcs)
    for (let r of brpcs) {
        if (r in excludes) { continue }
        syncOnceHandler(chain, r)
    }
}

const subscribeHandler = (chain: string, subscription: string) => {
    //
}

const subscribeService = (chain: string) => {
    const subs = G.rpcs.Subscribe
    let excludes = getExclude(chain)
    for (let s of subs) {
        if (s in excludes) { continue }
        subscribeHandler(chain, s)
    }
}

const kvService = (chain: string) => {
    // TODO
    // if kv config run config
    // else as the direct request
}


const extendsHandler = (chain: string) => {
    let extens = G.chainExt[chain]['extends']
    for (let r in extens) {
        switch(extens[r]) {
        case RpcStrategy.SyncOnce:
            syncOnceHandler(chain, r)   
            break
        case RpcStrategy.SyncLow:
            break
        case RpcStrategy.SyncAsBlock:
            break
        case RpcStrategy.Subscribe:
            break
        case RpcStrategy.Unsub:
            break
        case RpcStrategy.Kv:
            break
        case RpcStrategy.SyncKv:
            break
        case RpcStrategy.Abandon:
            // SBH
            break
        case RpcStrategy.Direct:
            // do nothing
            break
        default:
            break
        }
    }
}

const activeScheduler = (chain: string) => {
    // active this chain
}

const serviceTrigger = (chain: string) => {
    activeScheduler(chain)
    syncOnceService(chain)
    subscribeService(chain)
    kvService(chain)
}