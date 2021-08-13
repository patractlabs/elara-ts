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

const latestErrReq = async (ctx: KCtxT, next: NextT) => {
    let { chain, pid, size, page } = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    if (!Number.isInteger(size) || !Number.isInteger(page)) {
        throw Resp.Fail(400, 'size & page must be integer' as Msg)
    }
    if (size < 1) { size = 1 }
    const re = await Stat.recentError(chain, pid, size, page)
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

const methodRank = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid } = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    const re = await Stat.latestMethods(chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proDaily = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid } = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    const re = await Stat.proStatDaily(chain, pid)
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
    const re = await Stat.lastDaysOfProject(days, chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proLastHours = async (ctx: KCtxT, next: NextT) => {
    const { chain, pid, hours } = ctx.request.body
    checkPid(pid)
    checkChain(chain)
    if (!Number.isInteger(hours) || hours > 24 || hours < 1) {
        throw Resp.Fail(400, 'hours must be integer in[1, 24]' as Msg)
    }
    const re = await Stat.lastHoursOfProject(hours, chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}

const proDailyCountryStatistic = async(ctx: KCtxT, next: NextT) => {
    const {chain, pid, size, page} = ctx.request.body
    checkChain(chain)
    checkPid(pid)
    if (!Number.isInteger(size) || !Number.isInteger(page) || size < 1) {
        throw Resp.Fail(400, 'size & page must be integer [1, ?)' as Msg)
    }
    const re = await Stat.countryMap(chain, pid, size, page)
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
 * @apiSuccess {StatInfoT} Stat total statistic record with request & bandwidth
 * @apiSuccess {Integer} Stat.request  total request count
 * @apiSuccess {Integer} Stat.bandwidth total request bandwidth in byte
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
 * @apiSuccess {Integer} Stat.reqCnt total request count
 * @apiSuccess {Integer} Stat.wsConn ws connection count
 * @apiSuccess {Integer} Stat.subCnt ws subscribe count
 * @apiSuccess {Integer} Stat.subResCnt ws response count in subscription
 * @apiSuccess {Integer} Stat.bw total bandwidth
 * @apiSuccess {Integer} Stat.delay average delay ms
 * @apiSuccess {Integer} Stat.inReqCnt invalid request count
 * @apiSuccess {Integer} Stat.timeoutDelay average timeout ms
 * @apiSuccess {Integer} Stat.timeoutCnt timeout count
 * @apiSuccess {Integer} Stat.ctMap request country map {'US': 3, 'CZ': 100 , 'unknow': 1}
 *
 */
R.get('/daily', daily)

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
 * @apiParam {String} chain 
 * @apiParam {String} pid 
 *
 * @apiSuccess {Object} Rank resource rank info
 * @apiSuccessExample Success:
 * {
 *  code: 0,
 *  msg: 'ok',
 *  data: {
 *      bandwidth: {
 *          total: 1000     // bandwidth bytes,
 *          list: [{ method: 'systen_health', value: 100 }]
 *      },
 *      request: {
 *          total: 1024    // request count,
 *          list: [{ method: 'systen_health', value: 10 }]
 *      }
 *  }
 * }
 */
R.post('/project/rank', methodRank) 

/**
 *
 * @api {post} /stat/latest/error latestError
 * @apiDescription latest error record of all
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1}} size size of page
 * @apiParam {Integer} page page offset
 * @apiParam {String} chain 
 * @apiParam {String} pid
 *
 * @apiSuccess {Object} Object page object
 * @apiSuccess {Integer} Object.total total records
 * @apiSuccess {Integer} Object.size page size
 * @apiSuccess {Integer} Object.page page offset
 * @apiSuccess {Integer} Object.pages total pages
 * @apiSuccess {Object[]} Object.list  record list
 */
R.post('/project/error', latestErrReq)

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


/**
 *
 * @api {post} /stat/project/country countryRequestMap
 * @apiGroup stat
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1}} size size of page
 * @apiParam {Integer} page page offset
 * @apiParam {String} chain 
 * @apiParam {String} pid
 *
 * @apiSuccess {Object[]} Object page object
 */
R.post('/project/country', proDailyCountryStatistic)

export default R.routes()