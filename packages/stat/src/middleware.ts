import koa from "koa"
import { getAppLogger } from 'lib/utils/log'
import { Code, Msg } from "../lib/ApiCode"
import Result from '../lib/ApiResponse'

type NextT = () => Promise<any>
type KCtxT = koa.Context

const log = getAppLogger('stat-midware', true)

export const dashboard = async (ctx: KCtxT, next: NextT) => {
    if ('/dashboard' == ctx.path) {
        ctx.path = '/dashboard.html'
    }
    return next()
}

export const responseTime = async (ctx: KCtxT, next: NextT) => {
    const startT = Symbol('request-received.startTime') as any
    // const endT = Symbol.for('request-received.startTime')
    let start = ctx[startT] ? ctx[startT].getTime() : Date.now()
    await next()
    log.info(ctx.method, ctx.originalUrl, ctx.request.body, ctx.response.status || 404, ctx.response.length, 'byte', (Date.now() - start), 'ms')
}

export const authCheck = async (ctx: KCtxT, next: NextT) => {
    log.info('NO_AUTH env: ', process.env.NO_AUTH)
    if (process.env.NO_AUTH?.toLowerCase() === 'true') {
        ctx.state.user = 'Only for test'
        return next()
    }
    if (!ctx.isAuthenticated()) {
        throw Result.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}

export const errHanldle = async (ctx: KCtxT, next: NextT) => {
    return next().catch((error: any) => {
        log.error('Catch request error: ', error)
        if (error instanceof Result) {
            ctx.body = error
        } else {
            ctx.body = Result.Fail(Code.Unknown, Msg.Unknown)
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