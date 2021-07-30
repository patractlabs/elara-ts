import Stat from '../service/stat'
import { isEmpty, KCtxT, Msg, NextT, Resp } from '@elara/lib'
import Router from 'koa-router'

const R = new Router()

type PNextT = Promise<NextT>

function checkChain(chain: string) {
    if (isEmpty(chain)) {
        throw Resp.Fail(400, 'invalid chain' as Msg)
    }
}

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
    let { count } = ctx.request.body
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, 'count must be integer' as Msg)
    }
    if (count < 1) { count = 1}
    const re = await Stat.latestReq(count)
    ctx.body = Resp.Ok(re)
    return next()
}

const latestErrReq = async (ctx: KCtxT, next: NextT) => {
    let { count } = ctx.request.body
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, 'count must be integer' as Msg)
    }
    if (count < 1) { count = 1}
    const re = await Stat.recentError(count)
    ctx.body = Resp.Ok(re)
    return next()
}

const lastDays = async (ctx: KCtxT, next: NextT) => {
    const { days } = ctx.request.body
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, 'days must be integer' as Msg)
    }
    const re = await Stat.lastDays(days)
    ctx.body = Resp.Ok(re)
    return next()
}

const lastHours = async (ctx: KCtxT, next: NextT) => {
    const { hours } = ctx.request.body
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, 'hours must be integer' as Msg)
    }
    const re = await Stat.lastHours(hours)
    ctx.body = Resp.Ok(re)
    return next()
}

const mostResourceLastDays = async (ctx: KCtxT, next: NextT) => {
    const { count, days } = ctx.request.body
    const { type } = ctx.request.params
    console.log('type: ', type)
    if (type !== 'bandwidth' && type !== 'request') {
        throw Resp.Fail(400, 'invalid resource type' as Msg)
    }
    if (!Number.isInteger(days) || !Number.isInteger(count)) {
        throw Resp.Fail(400, 'params must be integer' as Msg)
    }
    const re = await Stat.mostResourceLastDays(count, days, type)
    ctx.body = Resp.Ok(re)
    return next()
}

// chain statistic
const chainTotal = async (ctx: KCtxT, next: NextT) => {
    const { chain } = ctx.request.params
    checkChain(chain)
    const re = await Stat.chain(chain)
    ctx.body = Resp.Ok(re)
    return next()
}

// project statistic
const proDaily = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid } = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    const re = await Stat.proDaily(chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proLastDays = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid, days }: { chain: string, pid: string, days: number } = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, 'days must be integer' as Msg)
    }
    const re = await Stat.lastDays(days, chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proLastHours = async (ctx: KCtxT, next: NextT) => {
    const { pid, hours } = ctx.request.body
    checkPid(pid)
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, 'hours must be integer' as Msg)
    }
    const re = await Stat.lastHours(hours, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

// elara
R.get('/total', total)
R.get('/daily', daily)
R.post('/latest', latestReq)
R.post('/days', lastDays)
R.post('/hours', lastHours)
R.post('/most/:type', mostResourceLastDays) // type request , bandwidth
R.post('/latest/error', latestErrReq)
// chain
R.get('/total/:chain', chainTotal)

// project
R.post('/project/daily', proDaily)
R.post('/project/days', proLastDays)
R.post('/project/hours', proLastHours)
export default R.routes()