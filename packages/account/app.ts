import Koa from 'koa'
import { accessLogger, getAppLogger } from 'lib'
import routerCompose from './src/router-compose'
import KoaBody from 'koa-body'
import Passport from './src/lib/passport'
import Session from 'koa-session'
import { setConfig } from './config'
import { accessControl, errHanldle, responseTime } from './src/middleware'

const app = new Koa()
const log = getAppLogger('account', true) //true: console open
const config = setConfig()

app.use(Session(config.session, app))
    .use(KoaBody({ multipart: true }))
    .use(accessLogger(true))
    .use(Passport.initialize())
    .use(Passport.session())
    .use(responseTime)
    .use(errHanldle)
    .use(accessControl)
    .use(routerCompose('./src/routers'))

app.on('error', (err) => {
    log.error('Stat service error: ', err)
})

app.listen('7004', () => {
    log.info('Listennig on port:7004')
})
