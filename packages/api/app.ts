import path from 'path'
import Koa from 'koa'
import KoaBody from 'koa-body'
import Kstatic from 'koa-static'
import Session from 'koa-session'
import { accessLogger, getAppLogger, dotenvInit } from '@elara/lib'
import { accessControl, authCheck, dashboard, errHanldle, responseTime } from './src/middleware'
import Passport from './src/lib/passport'
import Router from 'koa-router'
import limitRouter from './src/routers/limit'
import projectRouter from './src/routers/project'
import statRouter from './src/routers/stat'

dotenvInit()   // init dot env
const app = new Koa()
const router = new Router()

router.use('/limit', limitRouter)
router.use('/project', projectRouter)
router.use('/stat', statRouter)

export const log = getAppLogger('app')

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
    .use(router.routes())

app.on('error', (err) => {
    log.error('Stat service error: ', err)
})

app.listen('7002', () => {
    log.info('Stat service listen on port 7002')
})



