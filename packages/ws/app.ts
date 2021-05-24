import Koa from 'koa'
import EPuber from './src/epuber'
import { dotenvInit, getAppLogger } from '../lib'

dotenvInit()                    // if use .env
import Conf from 'config'       // have to be imported after dotenvInit
const app = new Koa()
const log = getAppLogger("ws", true)

EPuber.init()
app.listen("7001", () => {
    log.info("Api server listen on port: 7001", process.env.NODE_ENV)
    let re = Conf.get('redis')

    log.info('redis config: ', Conf.util.getEnv('NODE_ENV'), re)
})

