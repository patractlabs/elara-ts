import Koa from 'koa'
import KoaBody from 'koa-body'
import { getAppLogger, accessLogger, KCtxT, NextT, Resp, Code, Msg } from '@elara/lib'
import Router from 'koa-router'
import chainRouter from './src/routers/index'

const R = new Router()
const app = new Koa()
const log = getAppLogger('chain', true)
R.use('/chain', chainRouter)

const errHanldle = async (ctx: KCtxT, next: NextT) => {
    return next().catch((error: any) => {
        log.error('Catch request error: ', error)
        if (error instanceof Resp) {
            ctx.body = error
        } else {
            ctx.body = Resp.Fail(Code.Unknown, Msg.Unknown)
        }
    })
}

app.use(accessLogger(true))
app.use(errHanldle)
app.use(KoaBody({multipart: true, json: true}))
app.use(R.routes())

app.on('error', (err: string) => {
    log.error(`chain server error: ${err}`)
})

app.listen("7002", () => {
    log.info("Chain server listen on port: 7002")
})