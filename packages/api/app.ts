import Koa from 'koa'
import KoaBody from 'koa-body'
import Session from 'koa-session'
import { getAppLogger, dotenvInit, unexpectListener } from '@elara/lib'
import { accessControl, accessMidware, authCheck, errHanldle, responseTime } from './src/middleware'
import Passport from './src/lib/passport'
import Router from 'koa-router'
import limitRouter from './src/routers/limit'
import projectRouter from './src/routers/project'
import statRouter from './src/routers/stat'
import chainRouter from './src/routers/chain'
import userRouter from './src/routers/user'
import { authRouter } from './src/routers/auth'
import Conf from './config'
import publicRouter from './src/routers/public'

import sequelize from './src/sequelize'
import User from './src/models/user'
import Project from './src/models/project'
import Chain from './src/models/chain'
import Limit from './src/models/limit'
import ChainConfig from './src/models/chain-config'

dotenvInit()   // init dot env
const app = new Koa()
const router = new Router()
const server = Conf.getServer()

router.use('/auth', authRouter)
router.use('/public', publicRouter)
router.use('/limit', authCheck, limitRouter)
router.use('/project', authCheck, projectRouter)
router.use('/stat', authCheck, statRouter)
router.use('/chain', authCheck, chainRouter)
router.use('/user', authCheck, userRouter)

export const log = getAppLogger('app')

const session = {
    key: 'sid',
    signed: false,
    maxAge: 2592000000,
    httpOnly: false
}

app
    .use(accessMidware)
    .use(Session(session, app))
    .use(KoaBody({json: true}))
    .use(Passport.initialize())
    .use(Passport.session())
    .use(responseTime)
    .use(errHanldle)
    .use(accessControl)
    .use(router.routes())

app.on('error', (err) => {
    log.error('Stat service error: %o', err)
})

app.listen(server.port, async () => {
    sequelize.addModels([User, Project, Chain, ChainConfig, Limit])
    await sequelize.sync()
    log.info('elara api service listen on port %o: %o',server.port, process.env.NODE_ENV)
})

unexpectListener()