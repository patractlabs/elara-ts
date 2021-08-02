import Stat from "../service/stat";
import { isEmpty, KCtxT, Msg, NextT, Resp } from "@elara/lib";
import Router from "koa-router";

const R = new Router();

type PNextT = Promise<NextT>;

function checkChain(chain: string) {
    if (isEmpty(chain)) {
        throw Resp.Fail(400, "invalid chain" as Msg);
    }
}

function checkPid(pid: string) {
    if (isEmpty(pid) || pid.length !== 32) {
        throw Resp.Fail(400, "invalid project id" as Msg);
    }
}

/**
 *
 * @api {get} /stat/total total
 * @apiName total
 * @apiDescription 查询总的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 *
 */
const total = async (ctx: KCtxT, next: NextT): PNextT => {
    // elara statistic
    const re = await Stat.total();
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {get} /stat/daily daily
 * @apiName daily
 * @apiDescription 查询当天的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 *
 */
const daily = async (ctx: KCtxT, next: NextT) => {
    let dash = await Stat.daily();
    ctx.response.body = Resp.Ok(dash);
    return next();
};

/**
 *
 * @api {post} /stat/latest latest
 * @apiDescription 以小时为单位，查询最近的请求数量
 * @apiName latest
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam  {Integer{>=1}} count    小时数
 *
 */
const latestReq = async (ctx: KCtxT, next: NextT) => {
    let { count } = ctx.request.body;
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, "count must be integer" as Msg);
    }
    if (count < 1) {
        count = 1;
    }
    const re = await Stat.latestReq(count);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/latest/error/ error
 * @apiName error
 * @apiDescription 以小时为单位，查询最近错误的请求流量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {Integer{>=1}} count    小时数
 */
const latestErrReq = async (ctx: KCtxT, next: NextT) => {
    let { count } = ctx.request.body;
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, "count must be integer" as Msg);
    }
    if (count < 1) {
        count = 1;
    }
    const re = await Stat.recentError(count);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/days/ days
 * @apiName days
 * @apiDescription 以天为单位，查询最近的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {Integer{>=1}} count    天数
 */
const lastDays = async (ctx: KCtxT, next: NextT) => {
    const { days } = ctx.request.body;
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, "days must be integer" as Msg);
    }
    const re = await Stat.lastDays(days);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/hours/ hours
 * @apiName hours
 * @apiDescription 以小时为单位，查询最近的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {Integer{>=1}} count    小时数
 */
const lastHours = async (ctx: KCtxT, next: NextT) => {
    const { hours } = ctx.request.body;
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, "hours must be integer" as Msg);
    }
    const re = await Stat.lastHours(hours);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/most:type/ most
 * @apiName most
 * @apiDescription 查询请求数、流量最多的10个方法
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {Integer{>=1}} count    小时数
 * @apiParam {Integer{>=1}} days    天数
 * @apiParam {String{"bandwidth","request"}} type    查询类型
 */
const mostResourceLastDays = async (ctx: KCtxT, next: NextT) => {
    const { count, days } = ctx.request.body;
    const { type } = ctx.request.params;
    console.log("type: ", type);
    if (type !== "bandwidth" && type !== "request") {
        throw Resp.Fail(400, "invalid resource type" as Msg);
    }
    if (!Number.isInteger(days) || !Number.isInteger(count)) {
        throw Resp.Fail(400, "params must be integer" as Msg);
    }
    const re = await Stat.mostResourceLastDays(count, days, type);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {get} /stat/total/:chain chain
 * @apiName chain
 * @apiDescription 根据链的名称，查询该链的所有请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {String} chain    链的名称
 *
 */
const chainTotal = async (ctx: KCtxT, next: NextT) => {
    // chain statistic
    const { chain } = ctx.request.params;
    checkChain(chain);
    const re = await Stat.chain(chain);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/project/daily project-daily
 * @apiName project-daily
 * @apiDescription 根据项目id、链的名称，查询该链的当天请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {String} chain    链的名称
 * @apiParam {String} pid    项目的id
 *
 */
const proDaily = async (ctx: KCtxT, next: NextT) => {
    // project statistic
    const { chain, pid } = ctx.request.body;
    checkChain(chain);
    checkPid(pid);
    const re = await Stat.proDaily(chain, pid);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/project/days project-days
 * @apiName project-days
 * @apiDescription 以天为单位，根据项目id、链的名称、天数，查询该链的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {String} chain    链的名称
 * @apiParam {String} pid    项目的id
 * @apiParam {Integer{>=1}} days    天数
 *
 */
const proLastDays = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid, days }: { chain: string; pid: string; days: number } =
        ctx.request.body;
    checkChain(chain);
    checkPid(pid);
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, "days must be integer" as Msg);
    }
    const re = await Stat.lastDays(days, chain, pid);
    ctx.body = Resp.Ok(re);
    return next();
};

/**
 *
 * @api {post} /stat/project/hours project-hours
 * @apiName project-hours
 * @apiDescription 以小时为单位，根据项目id、链的名称、天数，查询该链的请求数量
 * @apiGroup stat
 * @apiVersion  0.0.1
 * @apiParam {String} chain    链的名称
 * @apiParam {String} pid    项目的id
 * @apiParam {Integer{>=1}} hours    小时数
 *
 */
const proLastHours = async (ctx: KCtxT, next: NextT) => {
    const { pid, hours } = ctx.request.body;
    checkPid(pid);
    if (!Number.isInteger(hours)) {
        throw Resp.Fail(400, "hours must be integer" as Msg);
    }
    const re = await Stat.lastHours(hours, pid);
    ctx.body = Resp.Ok(re);
    return next();
};

// elara
R.get("/total", total);
R.get("/daily", daily);
R.post("/latest", latestReq);
R.post("/days", lastDays);
R.post("/hours", lastHours);
R.post("/most/:type", mostResourceLastDays); // type request , bandwidth
R.post("/latest/error", latestErrReq);
// chain
R.get("/total/:chain", chainTotal);

// project
R.post("/project/daily", proDaily);
R.post("/project/days", proLastDays);
R.post("/project/hours", proLastHours);
export default R.routes();
