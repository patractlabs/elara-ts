import WebSocket from 'ws'
// import http from 'http'
// import url from 'url'
import { getAppLogger } from 'lib'
import { connHandler } from './handler'

const log = getAppLogger("ws", true)
const port = 80

const noop = () => {
    log.debug('noop')
}

const epuber = () => {
    let interval: NodeJS.Timeout

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
        clearInterval(interval)
    })
    
    wss.on('error', (err) => {
        log.error('Socket server error-evt: ', err);
        // TODO
        clearInterval(interval)

    })

    // ping-pong to detect broken connection
    interval = setInterval(() => {
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