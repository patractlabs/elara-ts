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
    if (count < 1) { count = 1 }
    const re = await Stat.latestReq(count)
    ctx.body = Resp.Ok(re)
    return next()
}

const latestErrReq = async (ctx: KCtxT, next: NextT) => {
    let { count } = ctx.request.body
    if (!Number.isInteger(count)) {
        throw Resp.Fail(400, 'count must be integer' as Msg)
    }
    if (count < 1) { count = 1 }
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

const chainTotal = async (ctx: KCtxT, next: NextT) => {
    const { chain } = ctx.request.params
    checkChain(chain)
    const re = await Stat.chain(chain)
    ctx.body = Resp.Ok(re)
    return next()
}

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
/**
 *
 * @api {get} /stat/total totalStatis
 * @apiDescription total statistic
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 *
 * @apiSuccess {StatT} Stat total statistic record
 */
R.get('/total', total)
/**
 *
 * @api {get} /stat/daily dayilyStatis
 * @apiDescription today statistic
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 *
 * @apiSuccess {StatT} Stat totay statistic record
 * @apiSuccess {Integer} Stat.wsReqNum ws request count
 * @apiSuccess {Integer} Stat.wsConn ws connection count
 * @apiSuccess {Integer} Stat.wsSubNum ws subscribe count
 * @apiSuccess {Integer} Stat.wsSubResNum ws response count in subscription
 * @apiSuccess {Integer} Stat.wsBw ws bandwidth
 * @apiSuccess {Integer} Stat.wsDelay ws average delay ms, ignore
 * @apiSuccess {Integer} Stat.wsInReqNum ws invalid request count
 * @apiSuccess {Integer} Stat.wsTimeout ws average timeout ms
 * @apiSuccess {Integer} Stat.wsTimeoutCnt ws timeout count
 * @apiSuccess {Integer} Stat.wsCt ws request country map {'US': 3, 'CZ': 100 , 'unknow': 1}
 * @apiSuccess {Integer} Stat.httpReqNum http request count
 * @apiSuccess {Integer} Stat.httpBw bandwidth bytes
 * @apiSuccess {Integer} Stat.httpDelay average response time ms
 * @apiSuccess {Integer} Stat.httpInReqNum invalid request count
 * @apiSuccess {Integer} Stat.httpTimeout http average timeout ms
 * @apiSuccess {Integer} Stat.httpTimeoutCnt timeout count
 * @apiSuccess {Integer} Stat.httpCt request country map
 */
R.get('/daily', daily)
/**
 *
 * @api {post} /stat/project/latest latestRequest
 * @apiDescription latest request of all
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1}} count latest request count to view
 *
 * @apiSuccess {Statistics[]} Stat statistic record list
 * @apiSuccess {String{'http', 'ws}} Stat.proto  request protocol
 * @apiSuccess {String} Stat.chain 
 * @apiSuccess {String} Stat.pid    project pid
 * @apiSuccess {String{'POST','PUT','GET'}} Stat.method http request method
 * @apiSuccess {ReqType} Stat.req  jsonrpc request body,{id, jsonrpc, method, params}
 * @apiSuccess {Number}  Stat.code jsonrpc request result code, 200 success, 419 out of limit
 * @apiSuccess {Header} Stat.header request header {origin, agent, ip}
 * @apiSuccess {Number} Stat.start performance trace time, ignore
 * @apiSuccess {String} Stat.type [noder,kv, cacher, recorder, conn], conn for subscribe connection,ignore
 * @apiSuccess {Number} Stat.delay response time[ms]
 * @apiSuccess {Number} [Stat.bw] response package size in bytes
 * @apiSuccess {Boolean} [Stat.timeout] timeout or not
 * @apiSuccess {Integer} [Stat.reqCnt] request cnt, for subscribe 
 * 
 */
R.post('/latest', latestReq)
/**
 *
 * @api {post} /stat/days lastDaysOfAll
 * @apiDescription last days statistic record of all
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1}} days days to view
 *
 * @apiSuccess {StatT} Stat last days statistic record list
 */
R.post('/days', lastDays)
/**
 *
 * @api {post} /stat/hours lastHoursOfAll
 * @apiDescription last hours statistic record of all
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1,<=24}} hours hours to view
 *
 * @apiSuccess {StatT[]} Stat statistic record list
 */
R.post('/hours', lastHours)
/**
 *
 * @api {post} /stat/most/:type requestRankByResource
 * @apiDescription today statistic record of project
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String{'request','bandwidth'}} type resource type
 * @apiParam {Integer{>=1,<=30}} days to statistic
 * @apiParam {Integer{>=1}} count statistic count to view
 *
 * @apiSuccess {String[]} Stat resource rank list
 * @apiSuccessExample SuccessRequest:
 * {
 *  code: 0,
 *  msg: 'ok',
 *  data: [
 *      'system_health',
 *      '10',       // request count
 *      'system_syncState',
 *      '8'
 *  ]
 * }
 * @apiSuccessExample SuccessBandwidth:
 * {
 *  code: 0,
 *  msg: 'ok',
 *  data: [
 *      'system_health',
 *      '10240012',     // bytes
 *      'system_syncState',
 *      '1278323'
 *  ]
 * }
 */
R.post('/most/:type', mostResourceLastDays) // type request , bandwidth

/**
 *
 * @api {post} /stat/latest/error latestError
 * @apiDescription latest error record of all
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1}} count record count to view
 *
 * @apiSuccess {Statistics[]} Stat statistic record list, see latestRequest
 */
R.post('/latest/error', latestErrReq)

/**
 *
 * @api {post} /stat/project/daily totalOfChain
 * @apiDescription total statistic record of chain
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} chain chain name
 *
 * @apiSuccess {StatT} Stat total statistic record
 */
R.get('/total/:chain', chainTotal)

/**
 *
 * @api {post} /stat/project/daily dayilyOfProject
 * @apiDescription today statistic record of project
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} chain chain name
 * @apiParam {String} pid  project pid
 *
 * @apiSuccess {StatT} Stat statistic record
 */
R.post('/project/daily', proDaily)

/**
 *
 * @api {post} /stat/project/days lastDaysOfProject
 * @apiDescription last days statistic record of project
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} chain chain name
 * @apiParam {String} pid  project pid
 * @apiParam {Integer{>=1, <=24}} days  how many hours to view
 *
 * @apiSuccess {StatT[]} Stat statistic record list
 */
R.post('/project/days', proLastDays)

/**
 *
 * @api {post} /stat/project/hours lastHoursOfProject
 * @apiDescription last hours statistic record of project
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} pid  project pid
 * @apiParam {Integer{>=1, <=24}} hours  how many hours to view
 *
 * @apiSuccess {StatT[]} Stat statistic record list
 */
R.post('/project/hours', proLastHours)
export default R.routes()