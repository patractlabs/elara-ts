import Koa from 'koa'
import Puber from './src/epuber'
import Suber, { G, Service } from './src/esuber'
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

