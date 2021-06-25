import Ws from 'ws'
import Util from '../src/util'
const log = console

const newConn = (url: string, port: number, path: string) => {
    const ws = new Ws(`ws://${url}:${port}/${path}`)

    // ws.once('open', () => {
    //     log.info('new ws conn open')
    // })

    // ws.on('close', (_code, _reason) => {
    //     // log.info('closed: ', code, reason)
    // })

    // ws.on('error', (err) => {
    //     log.error('ws error: ', err)
    // })

    // ws.on('message', (data) => {
    //     log.info('new msg: ', data)
    // })
    return ws
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
    // log.info('socket conn: ', wss)
    return wss
}

const methods = [
    'chain_getBlock', 'chain_getBlockHash', 'chain_getHeader', 'chain_getFinalizedHead',
    'system_syncState', 'system_health', 'system_version', 'system_chain', 'system_properties', 'system_chainType',
]

const topics = [
    'state_subscribeRuntimeVersion', 'state_subscribeStorage',
    'chain_subscribeNewHead', 'chain_subscribeAllHeads', 'chain_subscribeFinalizedHeads'
]

const wsTestRunner = (loop: number, newConn: boolean, conn: number, type: number = 0) => {
    let wss = connBuild(conn, '127.0.0.1', 7001)
    let lis = topics
    if (type === 0) {
        lis = methods
    }
    for (let w of wss) {
        // w.removeAllListeners()
        w.on('open', async () => {
            log.info('new open--------------------')
            if (loop <= 0) { loop = Number.MAX_VALUE } 
            for (let i = 0; i < loop; i++) {
            await Util.sleeps(15)
            for (let m of lis) {
                const req = `{"id": 1, "jsonrpc":"2.0", "method":"${m}","params":[]}`
                // log.info('ws state: ', w.readyState, req)
                if (w.readyState == 1) {
                    await Util.sleeps(0.1)
                    w.send(req)
                }
            }
            }
        })
    
        w.on('close', (_code, _reason) => {
            // log.info('closed: ', code, reason)
        })
    
        w.on('error', (err) => {
            log.error('ws error: ', err)
        })
    
        w.on('message', (data) => {
            log.info('new msg: ', data)
        })
    }
    if (newConn) {
        clearConn(wss)
        wss = connBuild(conn, '127.0.0.1', 7001)
    }
}

const clearConn = (wss: any[]) => {
    for (let w of wss) {
        w.close()
        delete wss[w]
    }
}

const connTestRunner = async (delay: number) => {
    const wss = connBuild(100, '127.0.0.1', 7001)
    await Util.sleeps(delay)
    clearConn(wss)
}

const connTest = async (loop: number) => {
    if (loop <= 0) {
        while (true) {
            log.info('======================start new iteration=========================')
            connTestRunner(1)
            log.info('----------------------close all-----------------------')
        }
    } else {
        for (let i = 0; i < loop; i++) {
            connTestRunner(1)
        }
    }
}


(async () => {
    if (true) {
        wsTestRunner(0, false, 300)
    } else {
        connTest(100)
    }
})()