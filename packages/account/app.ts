import Koa from 'koa'
import { accessLogger, getAppLogger } from '@elara/lib'
import Passport from './src/lib/passport'
import Router  from 'koa-router'
import authRouter from './src/routers/account'

const R = new Router()
R.use('/auth', authRouter)

const app = new Koa()
const log = getAppLogger('account', true) //true: console open

app
    .use(accessLogger(true))
    .use(Passport.initialize())
    .use(R.routes())

app.on('error', (err) => {
    log.error('Stat service error: ', err)
})

app.listen('7004', () => {
    log.info('Listennig on port:7004')
})
