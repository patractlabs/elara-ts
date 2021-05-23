/// service strategy: once request of chain received, init all 
/// the service of this chain. otherwise not init
/// 
/// TODO: SyncAsBlock is ovelap with the subscription
import WebSocket from 'ws'
import { getAppLogger } from 'lib'
import { newSuber } from './interface'
import { G } from './global'
import { fetchChains } from './chain'


const log = getAppLogger('esuber', true)


type OnMsgCb = (this: WebSocket, data: WebSocket.Data) => void
type OnErrCb = (this: WebSocket, err: Error) => void

const createSuber = (chain: string, url: string, cb: OnMsgCb, options?: {[key: string]: any}) => {
    const ws: WebSocket = new WebSocket(url)
    ws.on('open', () => {
        log.info('Open connection to Polkadot node ws', options)
        const sub = newSuber({chain, url, ws, ...options})
        G.ws[chain] = sub
        log.info('suber: ', G.ws)
        sub.ws.send(JSON.stringify(buildReq('system_health', [])))
    })
 
    ws.on('error', (err: any) => {
        log.error(`Suber[${chain}]-${G.ws[chain].cluster} Connect error: `, err)
    })

    ws.on('message', cb)
}


// init resource
export const setup = async (url: string) => {
    // init a ws connection for all chains
    let chain = 'Polkadot'
    await fetchChains()
    log.info('G chains: ', G.chains)
    createSuber(chain, url, (data: any) => {
        log.info(`Suber[${chain}]-${G.ws[chain].cluster} received node ws data: `, data)
        // TODO: cache data
    })
    // createSuber('Polkadot', url, {"stat": SubStat.Check})

    
}

const buildReq = (method: string, params: any[]) => {
    return {
        "id": 1,
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    }
}

// 



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


const syncOnceService = (chain: string) => {
    let brpcs = G.rpcs.SyncOnce
    let exts = G.chainExt[chain].SyncOnce
    log.info('brpcs-exts: ', brpcs, exts)
    brpcs?.push(...exts)
    log.info('rpcs: ', brpcs)
    for (let r of brpcs) {
        let req = buildReq(r, [])
        log.info('Req: ', req)
        G.ws[chain].ws.send(JSON.stringify(req))
    }
}

const subscribeService = (chain: string) => {
    // 1. get base subscription list
    // 2. extends and excludes
    // 3. request & cache
}

const kvService = (chain: string) => {

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

const init = ()=> {
    setup('ws://localhost:9944')
}

init()