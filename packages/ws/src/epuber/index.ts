import WebSocket from 'ws'
// import http from 'http'
// import url from 'url'
import { getAppLogger } from 'lib'

const log = getAppLogger("ws", true)
const port = 80

const noop = () => {
    log.debug('noop')
}

const heartBeat = (ws: any) => {
    log.debug('server heart beat')
    ws.isAlive = true
}

const epuber = () => {
    const wss = new WebSocket.Server({port}, () => {
        log.info('WebSocket server start on port: ', port)
    })

    wss.on('headers', (head) => {
        log.info('Socket server header-evt: ', head)
    })

    // req: http.IncomingMessage
    wss.on('connection', (ws: WebSocket, req: any) => {
        // TODO
        // 1. regist to Matcher
        // 2. statistic connection count
        // 3. open message listener  

        connHandler(ws, req)
    })

    wss.on('close', (msg: any) => {
        log.error('Socket server close-evt', msg)
        // TODO
    })
    
    wss.on('error', (err) => {
        log.error('Socket server error-evt: ', err);
        // TODO
    })

    // ping-pong to detect broken connection
    const interval = setInterval(() => {
        log.info('broadcast')
        wss.clients.forEach((ws: any) => {
            log.info('ws status:', ws.isAlive)
            if (ws.isAlive === false) {
                return ws.terminate()
            }
            ws.isAlive = false
            ws.ping(noop)
        })
    }, 5000)
}

const connHandler = (ws: WebSocket, req: any) => {

    // TODO
    // 1. message listener 
    // 2. esuber-trigger
    // 3. Matcher
    log.info('Into conn handler')
    // log.info('ws client: ', ws)
    // log.info('ws request: ', req)

    ws.on('pong', () => {
        heartBeat(ws)
    })

    ws.on('message', (data: any) => {
        log.info('Server msg-evt: ', data)
        ws.send("Hi buddy")
    })
}

// namespace NoServer {
//     const Server = http.createServer()
//     const wss = new WebSocket.Server({noServer: true})

//     Server.listen(port, () => {
//         log.info('Http server listen on port: ', port)
//     })

//     Server.on('upgrade', (req, socket, head) => {
//         const pathName = url.pathToFileURL(req.url)
//         log.info('path name: ', pathName)

//         wss.handleUpgrade(req, socket, head, (ws) => {
//             wss.emit('connection', ws, req)
//         })
//     })
// }
namespace EPuber {
    export const init = epuber
    
}
export = EPuber