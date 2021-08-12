import Stat from '../service/stat'
import { isEmpty, KCtxT, Msg, NextT, Resp } from '@elara/lib'
import Router from 'koa-router'

const R = new Router()

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

/**
 *
 * @api {post} /stat/project/rank requestRank
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
 * @apiSuccess {String} Object.list.proto http | ws
 * @apiSuccess {String} Object.list.mehtod  
 * @apiSuccess {String} Object.list.delay
 * @apiSuccess {String} Object.list.code
 * @apiSuccess {String} Object.list.time    timestamp string YYYY-MM-DD HH:mm
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
 * @apiParam {Integer{>=1, <=30}} days  how many days to view
 *
 * @apiSuccess {Object} Stat stat day duration info
 * @apiSuccess {String[]} Stat.timeline
 * @apiSuccess {StatInfoT[]} Stat.stats
 * @apiSuccess {Integer} Stat.stats.request request count
 * @apiSuccess {Integer} Stat.stats.bandwidth bandwidth in bytes
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
 * @apiSuccess {Object} Stat stat hour duration info
 * @apiSuccess {String[]} Stat.timeline
 * @apiSuccess {StatInfoT[]} Stat.stats
 * @apiSuccess {Integer} Stat.stats.request request count
 * @apiSuccess {Integer} Stat.stats.bandwidth bandwidth in bytes
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
 * @apiSuccess {Object} Object page object
 * @apiSuccess {Integer} Object.total total records
 * @apiSuccess {Integer} Object.size page size
 * @apiSuccess {Integer} Object.page page offset
 * @apiSuccess {Integer} Object.pages total pages
 * @apiSuccess {Object[]} Object.list  record list
 * @apiSuccess {String} Object.list.country 
 * @apiSuccess {String} Object.list.request request count  
 */
R.post('/project/country', proDailyCountryStatistic)

export default R.routes()