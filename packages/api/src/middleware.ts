import { accessLogger, Resp, Code, Msg, NextT, KCtxT } from '@elara/lib'
import { Context } from 'koa'

const log = accessLogger()

export const responseTime = async (ctx: KCtxT, next: NextT) => {
    const startT = Symbol('request-received.startTime') as any
    // const endT = Symbol.for('request-received.startTime')
    let start = ctx[startT] ? ctx[startT].getTime() : Date.now()
    await next()
    log.info(`${ctx.method} ${ctx.originalUrl} %o ${ctx.response.status || 404} ${ctx.response.length} byte ${(Date.now() - start)}ms`, ctx.request.body)
}

export const authCheck = async (ctx: KCtxT, next: NextT) => {
    if (process.env.NO_AUTH?.toLowerCase() === 'true') {
        ctx.state.user = 'TestUID'
        return next()
    }

    if (ctx.request.header.authorization === process.env.AUTH) {
        return next()
    }
    const re = ctx.isAuthenticated()
    if (!re) {
        log.error(`${ctx.state.user} auth check fail`)
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}

export const errHanldle = async (ctx: KCtxT, next: NextT) => {
    return next().catch((error: any) => {
        log.error('Catch request error: %o', error)
        if (error instanceof Resp) {
            ctx.body = error
        } else {
            ctx.body = Resp.Fail(Code.Unknown, Msg.Unknown)
        }
    })
}

export const accessControl = (ctx: KCtxT, next: NextT) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.set('Content-Type', 'application/json')
    ctx.set('Access-Control-Expose-Headers', 'Access-Control-Allow-Origin')
    ctx.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    ctx.set('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, PATCH, OPTIONS')
    ctx.set('Access-Control-Allow-Credentials', 'true')
    return next()
}

export const accessMidware = (ctx: KCtxT, next: NextT) => {
    const ct = ctx as Context
    const ip = ct.request.header['x-forwarded-for'] || ct.request.header.host
    let astr = `${ct.request.method} ${ct.request.url}, ${ip} ${ct.request.header['user-agent']}`
    log.http(astr)
    return next()
}