import Koa from 'koa'
import Suducer from './src/suducer'
import { getAppLogger } from 'lib'
import Conf from './config'
import Pusumer from './src/pusumer'

// dotenvInit()                    // if use .env
// import Conf from 'config'       // have to be imported after dotenvInit

const app = new Koa()
const log = getAppLogger("ws", true)

// Puber.init()
app.listen("7001", async () => {
    log.info("Api server listen on port: 7001")

    await Suducer.init()
    // log.info('Global chain exts: ', G.chainConf, G.chains)

    Pusumer.init()
    
})