import Koa from 'koa'
import ChainConf from './src/config'
import { getAppLogger } from '../lib/utils/log'

const app = new Koa()
const log = getAppLogger('chain')

app.listen("7002", () => {
    console.log("Chain server listen on port: 7001")
    let conf = new ChainConf('polkadot.io', '9999', '99', {authot: ['insert', 'rotate']})
    log.info(conf)
})