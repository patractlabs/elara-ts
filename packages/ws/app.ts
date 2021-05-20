import Koa from 'koa'
import { getAppLogger } from 'lib'
import { ChainConfig } from './src/config/chain'
import EPuber from './src/epuber'

const app = new Koa()
const log = getAppLogger("ws", true)

EPuber.init()
app.listen("7001", () => {
    log.info("Api server listen on port: 7001")
})

