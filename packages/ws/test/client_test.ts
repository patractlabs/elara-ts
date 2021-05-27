import WebSocket from 'ws'

import { getAppLogger } from 'lib'
const log = getAppLogger('wsc', true)

const ws = new WebSocket('ws://localhost:9944')

const ws1 = new WebSocket('ws://localhost:9944')

// ws.on('open', () =>{
//     log.info('ws 0 socket client connection open')
//     ws.send(`{"jsonrpc":"2.0","id":1,"method":"state_subscribeRuntimeVersion", "params":[]}`)
//     // ws.send(`{"jsonrpc":"2.0","id":1,"method":"state_subscribeStorage", "params":[]}`)

//     ws.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeNewHeads", "params":[]}`)
//     ws.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeAllHeads", "params":[]}`)
//     ws.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeFinalizedHeads", "params":[]}`)
// })

ws1.on('open', () => {
    log.info('ws 1 socket client connection open: ', this)
    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"state_subscribeRuntimeVersion", "params":[]}`)
    // ws.send(`{"jsonrpc":"2.0","id":1,"method":"state_subscribeStorage", "params":[]}`)

    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeNewHeads", "params":[]}`)
    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeAllHeads", "params":[]}`)
    ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeFinalizedHeads", "params":[]}`)
    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_subscribeFinalizedHeads", "params":[]}`)

    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_unsubscribeFinalizedHeads", "params":[]}`)
    // ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_unsubscribeFinalizedHeads", "params":[]}`)

})

ws.on('close', (code: number, reason: string) => {
    // 服务端关闭会触发
    // 主动close会触发
    log.error('ws 0 Client close-evt: ', code, reason)
})

ws1.on('close', (code: number, reason: string) => {
    // 服务端关闭会触发
    // 主动close会触发
    log.error('ws 1 Client close-evt: ', code, reason)
})

ws.on('message', (data: WebSocket.Data) => {
    console.log('ws 0------new msg in client: ', data)
})

ws1.on('message', (data: any) => {
    console.log('ws 1------new msg in client: ', data)
    let re = JSON.parse(data)
    if (re.result) {
        console.log('result: ', re.result)
        ws1.send(`{"jsonrpc":"2.0","id":1,"method":"chain_unsubscribeFinalizedHeads", "params":["${re.result}"]}`)

    }
    // let par = re['params']
    // console.log('subscription: ', par)
    
})

ws.on('error', (e: Error) => {
    console.log('ws 0 on error: ', e)
})

ws1.on('error', (e: Error) => {
    console.log('ws 1 on error: ', e)
})
// when connect will emit
ws.on('upgrade', (req: any) => {
    log.info('Socket client upgrade-evt: ') // long IncomingRequest
})

ws.on('unexpected-response', (req: any, res: any) => {
    log.info('Unexpected response: ', res)
})

const heartBeat = (ws: any) => {
    log.info('heart beat!', ws.pingTimeout)
    clearTimeout(ws.pingTimeout)
    ws.pingTimeout = setTimeout(() => {
        log.info('To terminate: ', ws.pingTimeout)
        ws.terminate()
    }, 5000 + 1000)
}

// ws.on('ping', () => {
//     heartBeat(ws)
// })

(() => {
    let sche = []
    sche[2] = 3
    console.log('array test', sche)
    let m: {[key in string]: number} = {
        'id1': 1,
        'id2': 3,
    }
    delete m['id1']
    console.log('map ', m)

    let op = {
        id1: '',
        id: null
    }

    const {id1, id } = op || {id: 3}
    console.log('default url: ', id, id1)
})()