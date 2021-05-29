import Koa from 'koa'
import WebSocket from 'ws'
import Puber from './src/pusumer'
import Suber from './src/suducer'
import { getAppLogger } from 'lib'
import Conf from './config'

// dotenvInit()                    // if use .env
// import Conf from 'config'       // have to be imported after dotenvInit

const app = new Koa()
const log = getAppLogger("ws", true)

// Puber.init()
app.listen("7001", async () => {
    log.info("Api server listen on port: 7001")

    await Suber.init()
    // log.info('Global chain exts: ', G.chainConf, G.chains)
    const poolConf = Conf.getWsPool()
    // log.info('pool config: ', poolConf)
    
})

const wss = new WebSocket.Server({port: 80})

wss.on('connection', (ws, req) => {
    log.info('new connection: ', wss.clients.size)
})