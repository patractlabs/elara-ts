import Koa from 'koa'
import WebSocket from 'ws'

import { getAppLogger } from '../lib/utils/log'

const app = new Koa()
const log = getAppLogger("api", true)

const wss = new WebSocket.Server({port: 80})

wss.on('open', () => {
    log.info("new ws open")
})

// req: http.IncomingMessage
wss.on('connection', (ws: WebSocket, req: any) => {
    log.info("Socket server connection-evt: ", wss.clients.size)
    ws.on('message', (msg: any) => {
        log.info('Socket server message-evt: ', msg)
    })
})

wss.on('close', () => {
    log.error('Socket server close-evt')
    // TODO
})

wss.on('error', (err) => {
    log.error('Socket server error-evt: ', err);
    
})

app.listen("7001", () => {
    log.info("Api server listen on port: 7001")
})


// const elara = new ws('ws://localhost:9944') 

// elara.on('open', () => {
//     console.log(' open node connection')
// })


// elara.on('close', () => {
//     console.log('elara close')
// })

// elara.on('error', (e:any) => {
//     console.log('on error: ', e)
// })
// for (let i = 0; i < 1000; i++) {
//     new ws('ws://localhost:9944') 
// }