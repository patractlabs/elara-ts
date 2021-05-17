import Dotenv from 'dotenv'
import path from 'path'
import Koa from 'koa'
import KoaBody from 'koa-body'
import Kstatic from 'koa-static'
import Session from 'koa-session'
import { accessLogger, getAppLogger } from 'lib/utils/log'
import { accessControl, authCheck, dashboard, errHanldle, responseTime } from './src/middleware'
import Passport from './lib/passport'

import routerCompose  from './src/routerCompose'

Dotenv.config()    // init dot env
const app = new Koa()
export const log = getAppLogger('stat', true)

const session = {
    key: 'elarasid',
    signed: false,
    maxAge: 2592000000,
    httpOnly: false
}

app
    .use(accessLogger(true))
    .use(dashboard)
    .use(Kstatic(path.join(__dirname, './static/html')))
    .use(Session(session, app))
    .use(KoaBody({ multipart: true }))
    .use(Passport.initialize())
    .use(Passport.session())
    .use(responseTime)
    .use(errHanldle)
    .use(authCheck)
    .use(accessControl)
    .use(routerCompose())

app.on('error', (err) => {
    log.error('Stat service error: ', err)
})
    
app.listen('7003', () => {
    log.info('Stat service listen on port 7003')
})



