import Ws from 'ws'
import Util from '../src/util'
const log = console

const newConn = (url: string, port: number, path: string) => {
    const ws = new Ws(`ws://${url}:${port}/${path}`)
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
    return wss
}

const methods = [
    'chain_getBlock', 'chain_getBlockHash', 'chain_getHeader', 'chain_getFinalizedHead',
    'system_syncState', 'system_health', 'system_version', 'system_chain', 'system_properties', 'system_chainType',
]

const topics = [
    'state_subscribeRuntimeVersion', 
    'chain_subscribeNewHead', 'chain_subscribeAllHeads', 'chain_subscribeFinalizedHeads'
]

const sendReq = async (w: Ws, lis: string[]) => {
    for (let m of lis) {
        const req = `{"id": 1, "jsonrpc":"2.0", "method":"${m}","params":[]}`
        if (w.readyState == 1) {
            await Util.sleeps(0.1)
            w.send(req)
        }
    }
}

const listenHandle = (w: Ws, lis: string[], loop: number, newConn: boolean = false) => {
    w.on('open', async () => {
        if (newConn) {
            sendReq(w, lis)
        } else {
            if (loop <= 0) { loop = Number.MAX_VALUE }
            for (let i = 0; i < loop; i++) {
                await Util.sleeps(3)
                sendReq(w, lis)
            }
        }
    })

    w.on('close', (code, reason) => {
        log.info('closed: %o %o', code, reason)
    })

    w.on('error', (err) => {
        log.error('ws error: %o', err)
    })

    w.on('message', (data) => {
        log.info('new msg: %o', data)
    })
}

const wsTestRunner = async (loop: number, newConn: boolean, conn: number, type: number = 0) => {
    let wss = connBuild(conn, '127.0.0.1', 7001)
    let lis = topics
    if (type === 0) {
        lis = methods
    }
    if (loop <= 0) { loop = Number.MAX_VALUE } 
    for (let i = 0; i < loop; i++) {

        for (let w of wss) {
            listenHandle(w, lis, loop, newConn)           
        }
        await Util.sleeps(10)
        if (newConn) {
            clearConn(wss)
            wss = connBuild(conn, '127.0.0.1', 7001)
        }
    }
}

const clearConn = (wss: any[]) => {
    for (let w of wss) {
        w.close()
    }
    wss = []
    log.info('----------------------close all-----------------------')

}

const connTestRunner = async (conn: number, delay: number) => {
    let wss = []
    let pat = 'jupiter/qwertyuiopasdfghjklzxcvb'
    for (let i = 0; i < conn; i++) { 
        const id = formatstr(i)
        const ws = newConn('127.0.0.1', 7001, `${pat}${id}`)
        ws.on('open', () => {
            log.info('open ws id i==================: ', i)
        })

        ws.on('close', () => {
            log.info('close===============: ', i)
        })
        wss.push(ws)
    }
    await Util.sleeps(delay)
    clearConn(wss)
}

const connTest = async (loop: number) => {
    if (loop <= 0) { loop = Number.MAX_VALUE }
    for (let i = 0; i< loop; i++) {
        await Util.sleeps(1)        
        connTestRunner(100, 4)
    } 
}


(async () => {
    if (true) {
        wsTestRunner(0, true, 300, 1)
    } else {
        // wsTestRunner(0, false, 100)
        connTest(0)
    }
})()