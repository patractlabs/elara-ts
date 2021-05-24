import Koa from 'koa'
import {ratelimit} from './src/access/ratelimit'
import router from './src/router/router'
import { accessLogger, getAppLogger } from 'lib'
const app = new Koa()
const log = getAppLogger('gateway', true) //true: console open


// have to inject before router
// TODO: config the router and blakc wihte list
app.use(accessLogger())
app.use(ratelimit())
app.use(router)

app.listen("7000", () => {
    log.info("Listennig on port:7000")
})