import Router from 'koa-router'
import { getAppLogger, KCtxT, NextT, Resp, Msg } from '@elara/lib'
import Stat from '../service/stat'

const R = new Router()
const log = getAppLogger('router')

async function elaraTotalStat(ctx: KCtxT, next: NextT) {
    const re = await Stat.total()
    ctx.body = Resp.Ok(re)
    log.debug('request elara total statistic: %o', re)
    return next()
}

async function daily(ctx: KCtxT, next: NextT) {
    let dash = await Stat.daily()
    ctx.response.body = Resp.Ok(dash)
    return next()
}

async function lastDays(ctx: KCtxT, next: NextT) {
    const { days } = ctx.request.body
    if (!Number.isInteger(days)) {
        throw Resp.Fail(400, 'days must be integer' as Msg)
    }
    const re = await Stat.lastDays(days)
    ctx.body = Resp.Ok(re)
    return next()
}
/**
 *
 * @api {get} /public/stat totalStatis
 * @apiDescription total statistic
 * @apiGroup NonAuth
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 *
 * @apiSuccess {StatInfoT} Stat total statistic record with request & bandwidth
 * @apiSuccess {Integer} Stat.request  total request count
 * @apiSuccess {Integer} Stat.bandwidth total request bandwidth in byte
 */

R.get('/stat', elaraTotalStat)

/**
 *
 * @api {get} /public/daily dayilyStatis
 * @apiDescription today statistic
 * @apiGroup  NonAuth
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
 * @api {post} /public/days lastDaysOfAll
 * @apiDescription last days statistic record of elara
 * @apiGroup NonAuth
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer{>=1, <=30}} days  how many days to view
 *
 * @apiSuccess {Object} Stat stat day duration info
 * @apiSuccess {String[]} Stat.timeline
 * @apiSuccess {StatInfoT[]} Stat.stats
 * @apiSuccess {Integer} Stat.stats.request request count
 * @apiSuccess {Integer} Stat.stats.bandwidth bandwidth in bytes
 */
R.post('/days', lastDays)

export default R.routes()