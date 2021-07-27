import Stat from '../service/stat'
import { formateDate } from '../lib/date'
import { KCtxT, NextT, Resp } from '@elara/lib'
import Router from 'koa-router'

const R = new Router()

type PNextT = Promise<NextT>

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
    const count = JSON.parse(ctx.request.body).count as number
    const re = await Stat.latestReq(count)
    ctx.body = re
    return next()
}

const lastDays = async(ctx: KCtxT, next: NextT) => {
    const days = JSON.parse(ctx.request.body).days as number
    const re = await Stat.lastDays(days)
    ctx.body = Resp.Ok(re)
    return next()
}

const lastHours = async(ctx: KCtxT, next: NextT) => {
    const hours = JSON.parse(ctx.request.body).hours as number
    const re = await Stat.lastHours(hours)
    ctx.body = Resp.Ok(re)
    return next()
}

// chain statistic

// project statistic
const proDaily = async (ctx: KCtxT, next: NextT) => {
    const pid = JSON.parse(ctx.request.body).pid
    const re = await Stat.proDaily(pid)
    ctx.body = Resp.Ok(re)
    return next()
}

let chain = async (ctx: KCtxT, next: NextT) => {
    let chainInfo = await Stat.getChain()
    ctx.response.body = Resp.Ok(chainInfo).toString()
    return next()
}

let day = async (ctx: KCtxT, next: NextT) => {
    let today = formateDate(new Date())
    // let uid = ctx.state.user
    let pid = ctx.request.params.pid
    let date = ctx.request.params.date ? parseInt(ctx.request.params.date) : today

    // await checkProject(pid, uid)
    let dayInfo = await Stat.day(pid, date as string)
    ctx.response.body = Resp.Ok(dayInfo).toString()
    return next()
}

let week = async (ctx: KCtxT, next: NextT) => {
    // let uid = ctx.state.user
    let pid = ctx.request.params.pid

    // await checkProject(pid, uid)
    let day7 = await Stat.days(pid, 7)
    ctx.response.body = Resp.Ok(day7).toString()
    return next()
}

let month = async (ctx: KCtxT, next: NextT) => {

    // let uid = ctx.state.user
    let pid = ctx.request.params.pid

    // await checkProject(pid, uid)
    let day30 = await Stat.days(pid, 30)
    ctx.response.body = Resp.Ok(day30).toString()
    return next()
}

let requests = async (ctx: KCtxT, next: NextT) => {
    let req20 = await Stat.requests(20)
    ctx.response.body = Resp.Ok(req20).toString()
    return next()
}



R.get('/chain', chain)
R.get('/day/:pid([a-z0-9]{32})', day)
R.get('/week/:pid([a-z0-9]{32})', week)
R.get('/month/:pid([a-z0-9]{32})', month)
R.get('/requests', requests)

//
R.get('/total', total)
R.get('/daily', daily)
R.post('/latest', latestReq)
R.post('/days', lastDays)
R.post('/hours', lastHours)
R.post('/project/daily', proDaily)

export default R.routes()