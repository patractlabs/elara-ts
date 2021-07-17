import { Resp, NextT, KCtxT } from '@elara/lib'
import Router from 'koa-router'

const R = new Router()

let login = async (ctx: KCtxT, next: NextT) => {
    console.log()

    if (ctx.isAuthenticated()) {
    }
    ctx.response.body = Resp.Ok().toString()
    return next()
}

let github = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString()

    return next()
}
let callback = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString()
    return next()
}
let logout = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString()
    return next()
}

R.get('/login', login)
R.get('/github', github)
R.get('/github/callback', callback)
R.get('/logout', logout)

export default R.routes()
