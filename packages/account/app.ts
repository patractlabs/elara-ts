import Koa from 'koa'
import { accessLogger, getAppLogger } from 'elara-lib'
import routerCompose from './src/router-compose'
import Passport from './src/lib/passport'


const app = new Koa()
const log = getAppLogger('account', true) //true: console open

app
    .use(accessLogger(true))
    .use(routerCompose('./src/routers'))
    .use(Passport.initialize())

app.on('error', (err) => {
    log.error('Stat service error: ', err)
})

app.listen('7004', () => {
    log.info('Listennig on port:7004')
})
