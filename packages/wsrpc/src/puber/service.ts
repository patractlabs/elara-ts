/// websocket server mode: share the http server connection

// history service  <-- SQL
// cache service <-- redis
// subscribe without params <-- redis stream
// subscribe with params <-- matcher
// others <-- matcher
// matcher: node socket connections 


import WebSocket from 'ws'
import http from 'http'
import { getAppLogger } from 'lib'


const log = getAppLogger('puber', true)

const server = () => {

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
        log.info('New connection build', wss.clients.size, req)
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


    httpServer.on('connection', (socket) => {
        log.info('Http server connected: ', socket)
    })
}

namespace Service {
    export const up = () => {
        server()
        log.info('Puber service up!')
    }

    export namespace Cache {
        // --> suducer

    }

    export namespace SubnoParam {
        // --> suducer

    }

    export namespace History {
        // --> pg SQL history
    }

    export namespace SubParam {
        // subscribe_storage with key --> kv
        // watchExtrinistic --> node


    }

    export namespace Direct {
        // --> node

    }
}

export default Service