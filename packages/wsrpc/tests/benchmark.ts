import Ws from 'ws'
import { randomId } from '@elara/lib'
const log = console

async function sleeps(s: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, s * 1000))
}

const newConn = (url: string, port: number, path: string): Ws => {
    return new Ws(`ws://${url}:${port}/${path}`)
}

const formatstr = (i: number) => {
    const istr = i.toString()
    const len = istr.length
    return ('0000000' + istr).substr(len-1, 8)
}

const connBuild = (cnt: number, url: string, port: number) => {
    let wss = []
    let pat = 'jupiter/qwertyuiopasdfghjklzxcvb'
    for (let i = 0; i < cnt; i++) { 
        const id = formatstr(i)
        const ws = newConn(url, port, `${pat}${id}`)
        wss.push(ws)
    }
    return wss
}

const methods = [
    'chain_getBlock', 'chain_getBlockHash', 'chain_getHeader', 'chain_getFinalizedHead',
    'system_syncState', 'system_health', 'system_version', 'system_chain', 'system_properties', 'system_chainType',
    'system_peers', 'author_pendingExtrinsics', 'author_rotateKeys',
    'state_getRuntimeVersion', 'chain_getRuntimeVersion', 'invalid_method'
]

const topics = [
    'state_subscribeRuntimeVersion', 
    'chain_subscribeNewHead', 'chain_subscribeAllHeads', 'chain_subscribeFinalizedHeads',
    'state_subscribeStorage'
]

const sendReq = async (w: Ws, lis: string[]) => {
    for (let m of lis) {
        const req = {"id": randomId(), "jsonrpc":"2.0", "method": m,"params":[]}
        if (w.readyState == 1) {
            await sleeps(0.1)
            if (m === 'state_subscribeStorage') {
                let id = randomId()
                const reqParam = {"id": id, "jsonrpc":"2.0", "method":m,"params":[["0x2aeddc77fe58c98d50bd37f1b90840f9cd7f37317cd20b61e9bd46fab87047149c21b6ab44c00eb3127a30e486492921e58f2564b36ab1ca21ff630672f0e76920edd601f8f2b89a"]]}
                w.send(JSON.stringify(reqParam))
            }
            w.send(JSON.stringify(req))
        }
    }
}

const listenHandle = (w: Ws, lis: string[], loop: number, newConn: boolean = false) => {
    w.on('open', async () => {
        // log.info('new open--------------------')
        if (newConn) {
            sendReq(w, lis)
        } else {
            if (loop <= 0) { loop = Number.MAX_VALUE }
            for (let i = 0; i < loop; i++) {
                sendReq(w, lis)
            }
        }
    })

    w.on('close', (code, reason) => {
        log.info('closed: %o, %o', code, reason)
    })

    w.on('error', (err) => {
        log.error('ws error: %o', err)
    })

    w.on('message', (data) => {
        log.info('new msg: %o', data)
    })
}

enum WsTyp {
    Sub = 'sub',
    Rpc = 'rpc',
    All = 'all'
}

export const wsTestRunner = async (loop: number, newConn: boolean, conn: number, type: WsTyp) => {
    let wss = connBuild(conn, '127.0.0.1', 7001)
    let lis = topics
    if (type === WsTyp.Rpc) {
        lis = methods
    } else if (type === WsTyp.All) {
        lis.push(...methods)
    }
    if (loop <= 0) { loop = Number.MAX_VALUE } 
    for (let i = 0; i < loop; i++) {
        if (wss.length === 0) {
            wss = connBuild(conn, '127.0.0.1', 7001)
        }

        for (let w of wss) {
            listenHandle(w, lis, loop, newConn)           
        }
        await sleeps(10)
        if (newConn) {
            clearConn(wss)
            wss = []
        }
    }
}

const clearConn = (wss: any[]) => {
    for (let w of wss) {
        w.close()
    }
    log.info('====================all connection closed=======================')
}

const connTestRunner = async (conn: number, delay: number) => {
    let wss = []
    let pat = 'polkadot/qwertyuiopasdfghjklzxcvb'
    for (let i = 0; i < conn; i++) { 
        const id = formatstr(i)
        const ws = newConn('127.0.0.1', 7001, `${pat}${id}`)
        ws.on('open', () => {
            log.info('open ws id: %o', i)
        })

        ws.on('close', () => {
            log.info('close connection id: %o', i)
        })

        ws.on('error', (err) => {
            log.error(`error id ${i}: %o`, err)
        })
        wss.push(ws)
    }
    await sleeps(delay)
    clearConn(wss)
}

const connTest = async (loop: number) => {
    if (loop <= 0) { loop = Number.MAX_VALUE }
    for (let i = 0; i< loop; i++) {
        await sleeps(1)        
        await connTestRunner(100, 4)
    } 
}


(async () => {
    if (true) {
        wsTestRunner(0, true, 100, WsTyp.All)
        
    } else {
        // wsTestRunner(0, false, 100)
        connTest(0)
    }
})()