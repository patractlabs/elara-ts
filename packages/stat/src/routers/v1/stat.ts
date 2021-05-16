import { Context } from 'koa'
import Result from '../../../lib/ApiResponse'
import Stat from '../../service/stat'
import { checkAuthenticated, checkProject} from '../../../lib/check'
import { formateDate } from '../../../lib/date'

let chain = async (ctx: any, next: any) => {
    let chainInfo = await Stat.getChain()
    ctx.response.body = Result.Ok(chainInfo).toString()
    return next()
}

let day = async (ctx: any, next: any) => {
    let today = formateDate(new Date())

    if( !checkAuthenticated(ctx)){
        return next()
    }
    let uid = ctx.state.user
    let pid = ctx.request.params.pid
    let date = ctx.request.params.date ? parseInt(ctx.request.params.date) : today

    await checkProject(pid, uid)
    let dayInfo = await Stat.day(pid, date)
    ctx.response.body = Result.Ok(dayInfo).toString()
    return next()
}

let week = async (ctx: any, next: any) => {
    if( !checkAuthenticated(ctx)){
        return next()
    }
    let uid = ctx.state.user
    let pid = ctx.request.params.pid

    await checkProject(pid, uid)
    let day7 = await Stat.days(pid,7)
    ctx.response.body = Result.Ok(day7).toString()
    return next()
}

let month = async (ctx: any, next: any) => {
    if( !checkAuthenticated(ctx)){
        return next()
    }
    let uid = ctx.state.user
    let pid = ctx.request.params.pid

    await checkProject(pid, uid)
    let day30 = await Stat.days(pid,30)
    ctx.response.body = Result.Ok(day30).toString()
    return next()
}

let requests = async (ctx: any, next: any) => {
    let req20 = await Stat.requests(20)
    ctx.response.body = Result.Ok(req20).toString()
    return next()
}

let dashboard=async (ctx: any, next: any) => {
    let dash = await Stat.dashboard()
    ctx.response.body = Result.Ok(dash).toString()
    return next()
}

module.exports = {
    'GET /stat/chain': chain, //链总请求数
    'GET /stat/day/:pid([a-z0-9]{32})': day, //项目的今天统计信息
    'GET /stat/week/:pid([a-z0-9]{32})': week, //项目的周统计信息
    'GET /stat/month/:pid([a-z0-9]{32})': month, //项目的今天统计信息
    'GET /stat/requests': requests, // last request
    'GET /stat/dashboard': dashboard
}