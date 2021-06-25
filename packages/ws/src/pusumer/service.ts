/// websocket server mode: share the http server connection


import WebSocket from 'ws'
import http from 'http'
import { getAppLogger } from 'lib'

const log = getAppLogger('pusumer', true)

// 1. init websocker server resource
// 2. connection allocate  
// 3. service monitor    
// 4. chain ws connection too much will error
//
let cnt = 0
const server = () => {
    // const server = new WebSocket.Server({
    //     host: '127.0.0.1',
    //     port: 80,
    //     noServer: false,
    // }, () => { 
    //     log.info('new web server listen on port: 80')
    // })

    const httpServer = http.createServer()

    // const wss = new WebSocket.Server({ server: httpServer })
    const wss = new WebSocket.Server({ noServer: true })


    httpServer.on('upgrade', (req, socket, head) => {
        // const pathName = new URL(req.url).pathname
        const pathName = req.url
        log.info('path name: ', pathName)
        
        if (pathName === '/') {
            wss.handleUpgrade(req, socket, head, (ws) => {
                log.info('handle upgrade ')
                wss.emit('connection', ws, req)
            })
        }
      


    })

    wss.on('connection', (ws: WebSocket, req: any) => {
        log.info('New connection build', wss.clients.size)
        cnt += 1
        // if (cnt > 5000) {
        //     log.info('close client')
        //     ws.terminate()
        //     cnt -= 1
        // }
        ws.on('close', (code, reason) => {
            log.error('Websocket close event: ', code, reason)
        })

        ws.on('error', (err) => {
            log.error('Websocket error: ', err)
        })

        ws.on('message', (data) => {
            log.info('New msg received: ', data)
        })

    })

    httpServer.listen(7003, () => {
        log.info('http server listen on port: ', 7003)
    })

    httpServer.on('error', (err) => {
        log.error('Http server error: ', err)
    })

    // httpServer.on('close', () => {
    //     log.error('Http server closed: ', )
    // })

    // httpServer.on('listening', () => {
    //     log.info('Http server listening', )
    // })

    httpServer.on('connection', (socket) => {
        log.info('Http server connected: ')
    })
}

namespace Service {
    export const up = () => {
        server()
        log.info('Pusumer service up!')
    }
}

export default Service