import Stat from "../../service/stat";
import { formateDate } from "../../lib/date";
import { KCtxT, NextT, Resp } from "elara-lib";

let chain = async (ctx: KCtxT, next: NextT) => {
    let chainInfo = await Stat.getChain();
    ctx.response.body = Resp.Ok(chainInfo).toString();
    return next();
};

let day = async (ctx: KCtxT, next: NextT) => {
    let today = formateDate(new Date());
    // let uid = ctx.state.user;
    let pid = ctx.request.params.pid;
    let date = ctx.request.params.date
        ? parseInt(ctx.request.params.date)
        : today;

    // await checkProject(pid, uid)
    let dayInfo = await Stat.day(pid, date);
    ctx.response.body = Resp.Ok(dayInfo).toString();
    return next();
};

let week = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user;
    let pid = ctx.request.params.pid;

    // await checkProject(pid, uid)
    let day7 = await Stat.days(pid, 7);
    ctx.response.body = Resp.Ok(day7).toString();
    return next();
};

let month = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user;
    let pid = ctx.request.params.pid;

    // await checkProject(pid, uid)
    let day30 = await Stat.days(pid, 30);
    ctx.response.body = Resp.Ok(day30).toString();
    return next();
};

let requests = async (ctx: KCtxT, next: NextT) => {
    let req20 = await Stat.requests(20);
    ctx.response.body = Resp.Ok(req20).toString();
    return next();
};

let dashboard = async (ctx: KCtxT, next: NextT) => {
    let dash = await Stat.dashboard();
    ctx.response.body = Resp.Ok(dash).toString();
    return next();
};

module.exports = {
    "GET /stat/chain": chain, //链总请求数
    "GET /stat/day/:pid([a-z0-9]{32})": day, //项目的今天统计信息
    "GET /stat/week/:pid([a-z0-9]{32})": week, //项目的周统计信息
    "GET /stat/month/:pid([a-z0-9]{32})": month, //项目的今天统计信息
    "GET /stat/requests": requests, // last request
    "GET /stat/dashboard": dashboard,
};
