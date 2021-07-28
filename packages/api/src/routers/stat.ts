import Stat from '../service/stat'
import { isEmpty, KCtxT, Msg, NextT, Resp } from '@elara/lib'
import Router from 'koa-router'

const R = new Router()

type PNextT = Promise<NextT>

function checkPid(pid: string) {
    if (isEmpty(pid) || pid.length !== 32) {
        throw Resp.Fail(400, 'invalid project id' as Msg)
    }
}

// elara statistic
const total = async (ctx: KCtxT, next: NextT): PNextT => {
    const re = await Stat.total()
    ctx.body = Resp.Ok(re)
    return next()
}

const daily = async (ctx: KCtxT, next: NextT) => {
    let dash = await Stat.daily()
    ctx.response.body = Resp.Ok(dash)
    return next()
}

const latestReq = async (ctx: KCtxT, next: NextT) => {
    const count = JSON.parse(ctx.request.body).count as number ?? 20
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, 'count must be integer' as Msg)
    }
    const re = await Stat.latestReq(count)
    ctx.body = Resp.Ok(re)
    return next()
}

const lastDays = async (ctx: KCtxT, next: NextT) => {
    const days = JSON.parse(ctx.request.body).days
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, 'days must be integer' as Msg)
    }
    const re = await Stat.lastDays(days)
    ctx.body = Resp.Ok(re)
    return next()
}

const lastHours = async (ctx: KCtxT, next: NextT) => {
    const hours = JSON.parse(ctx.request.body).hours
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, 'hours must be integer' as Msg)
    }
    const re = await Stat.lastHours(hours)
    ctx.body = Resp.Ok(re)
    return next()
}

// chain statistic

// project statistic
const proDaily = async (ctx: KCtxT, next: NextT) => {
    const pid = JSON.parse(ctx.request.body).pid
    checkPid(pid)
    const re = await Stat.proDaily(pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proLastDays = async (ctx: KCtxT, next: NextT) => {
    const { pid, days }: { pid: string, days: number } = JSON.parse(ctx.request.body)
    checkPid(pid)
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, 'days must be integer' as Msg)
    }
    const re = await Stat.lastDays(days, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proLastHours = async (ctx: KCtxT, next: NextT) => {
    const { pid, hours } = JSON.parse(ctx.request.body)
    checkPid(pid)
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, 'hours must be integer' as Msg)
    }
    const re = await Stat.lastHours(hours, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

//
R.get('/total', total)
R.get('/daily', daily)
R.post('/latest', latestReq)
R.post('/days', lastDays)
R.post('/hours', lastHours)

R.post('/project/daily', proDaily)
R.post('/project/days', proLastDays)
R.post('/project/hours', proLastHours)
export default R.routes()