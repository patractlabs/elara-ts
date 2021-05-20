import WebSocket from 'ws'

import { getAppLogger } from 'lib'
const log = getAppLogger('wsc', true)

const ws = new WebSocket('ws://localhost:80')

ws.on('open', () =>{
    log.info('socket client connection open')
    ws.send(`{"jsonrpc":"2.0","id":1,"method":"system_peers", "params":[]}`)
})

ws.on('close', (code: number, reason: string) => {
    // 服务端关闭会触发
    // 主动close会触发
    log.error('Client close-evt: ', code, reason)
})

ws.on('message', (data: WebSocket.Data) => {
    console.log('new msg in client: ', data)
})

ws.on('error', (e: Error) => {
    console.log('on error: ', e)
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