import Http from 'http'
import WebSocket from 'ws'
import { getAppLogger, isNone, isErr } from 'lib'
import Puber from './src/puber'
import Suber from './src/suber'
import Util from './src/util'

const log = getAppLogger('Node', true)
const Server =  Http.createServer()
const wss = new WebSocket.Server({ noServer: true })

// server 
Server.on('upgrade', async (res, socket, head) => {
    const path = res.url
    const re: any = Util.urlParse(path)
    if (isNone(re)) {
        log.error('Invalid socket request: ', path)
        return
    }
 
    // only handle urlReg pattern request
    wss.handleUpgrade(res, socket, head, (ws, req: any) => {
        log.info('Handle upgrade event')
        req['chain'] = re.value.chain
        req['pid'] = re.value.pid
        wss.emit('connection', ws, req)
    })
})

wss.on('connection', async (ws, req: any) => {

    log.info(`New socket connection CHAIN[${req.chian}] PID[${req.pid}]`, req.chain, req.pid)
    // 
    let re = await Puber.onConnect(ws, req.chain, req.pid)
    if (isErr(re)) {
        log.error('Connect handle error: ', re.value)
        ws.terminate()
        return
    }
    const puber = re.value as Puber
    ws.on('message', (data) => {
        log.info('New msg-evt: ', data)
        Puber.onMessage(puber, data)
    })
 
    ws.on('close', (code, reason) => {
        log.error('Connection closed: ', code, reason)
        Puber.clear(puber.id)
    })

    ws.on('error', (err) => {
        log.error('Connection error: ', err)
        ws.terminate()
        Puber.clear(puber.id)
    })
    return
})


const run = async () => {
    await Suber.init()
    Server.listen(7001, () => {
        log.info('Elara node server listen on port: 7001')
    })
}

run()