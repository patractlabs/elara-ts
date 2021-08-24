import { Resp, Msg, NextT, KCtxT, isErr } from '@elara/lib'
import Router from 'koa-router'
import Limit from '../service/limit'
import { LimitAttr } from '../models/limit'
import { UserLevel } from '../models/user'

const R = new Router()

async function add(ctx: KCtxT, next: NextT) {
    const attr = ctx.request.body as LimitAttr
    if (!Object.values(UserLevel).includes(attr.level)) {
        throw Resp.Fail(400, 'invalid level' as Msg)
    }
    const re = await Limit.add(attr)
    if (isErr(re)) {
        throw Resp.Fail(400, 'add error' as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function destroy(ctx: KCtxT, next: NextT) {
    const { id } = ctx.request.body
    const re = await Limit.delete(id)
    if (isErr(re) || !re.value) {
        throw Resp.Fail(400, 'destroy error' as Msg)
    }
    ctx.body = Resp.Ok()
    return next()
}

async function update(ctx: KCtxT, next: NextT) {
    const attr = ctx.request.body as LimitAttr
    const re = await Limit.update(attr)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function findById(ctx: KCtxT, next: NextT) {
    const { id } = ctx.request.body
    const re = await Limit.findById(id)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function findByLevel(ctx: KCtxT, next: NextT) {
    const { level } = ctx.request.body
    if (!Object.values(UserLevel).includes(level)) {
        throw Resp.Fail(400, 'invalid level' as Msg)
    }
    const re = await Limit.findByLevel(level)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

if (process.env.NODE_ENV === 'dev') {
    R.post('/add', add)
    R.post('/delete', destroy)
    R.post('/update', update)
    R.post('/detail/byid', findById)
    R.post('/detail/bylevel', findByLevel)
}

export default R.routes()

