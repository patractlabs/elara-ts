import WebSocket from 'ws'
import { getAppLogger } from 'lib'

const log = getAppLogger('epuber', true)

const heartBeat = (ws: any) => {
    log.debug('server heart beat')
    ws.isAlive = true
}

export const connHandler = (ws: WebSocket, req: any) => {

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