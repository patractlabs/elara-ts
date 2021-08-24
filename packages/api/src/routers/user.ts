import { Resp, NextT, KCtxT, Msg, isErr, getAppLogger } from '@elara/lib'
import Router from 'koa-router'
import User from '../service/user'
import { UserAttr, UserLevel, UserStat } from '../models/user'


const R = new Router()
const log = getAppLogger('user')

async function updateStatus(ctx: KCtxT, next: NextT) {
    const { githubId, status } = ctx.request.body
    if (!Object.values(UserStat).includes(status)) {
        throw Resp.Fail(400, 'invalid status' as Msg)
    }
    let gitId = ctx.state.user || githubId
    if (gitId === undefined) {
        throw Resp.Fail(400, 'invalid githubId' as Msg)
    }
    User.updateStatusByGit(gitId, status)
    ctx.body = Resp.Ok()
    return next()
}

async function updateLevel(ctx: KCtxT, next: NextT) {
    const { level } = ctx.request.body
    if (!Object.values(UserLevel).includes(level)) {
        throw Resp.Fail(400, 'invalid level' as Msg)
    }
    User.updateLevelByGit(ctx.state.user, level)
    ctx.body = Resp.Ok()
    return next()
}

async function detail(ctx: KCtxT, next: NextT) {
    const re = await User.findUserByGit(ctx.state.user)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function detailWithProject(ctx: KCtxT, next: NextT) {
    const { githubId } = ctx.request.body
    const re = await User.findUserByGitWithProject(ctx.state.user || githubId)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function detailWithLimit(ctx: KCtxT, next: NextT) {
    const { userId } = ctx.request.body
    const re = await User.findUserByIdwithLimit(userId)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function getStatus(ctx: KCtxT, next: NextT) {
    const re = await User.getStatusByGit(ctx.state.user)
    log.debug('get status result: %o', re)
    ctx.body = Resp.Ok(re)
    return next()
}

async function getLevel(ctx: KCtxT, next: NextT) {
    const re = await User.getLevelByGit(ctx.state.user)
    log.debug('get level result: %o', re)
    ctx.body = Resp.Ok(re)
    return next()
}

async function getDailyStatistic(ctx: KCtxT, next: NextT) {
    const { userId } = ctx.request.body
    const re = await User.getStatisticById(userId)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function newUser(ctx: KCtxT, next: NextT) {
    const { githubId, name, loginType } = ctx.request.body as UserAttr
    const re = await User.create({ githubId, name, loginType } as UserAttr)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function getAllUser(ctx: KCtxT, next: NextT) {
    const re = await User.getAllUser()
    ctx.body = Resp.Ok(re.value)
    return next()
}

/**
 * @api {get} /user/detail detail
 * @apiDescription user detail info
 * @apiGroup user
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiSuccess {UserAttr} User
 * @apiSuccess {Integer} User.id    user id
 * @apiSuccess {String} User.name   user ame
 * @apiSuccess {String{'active','suspend','barred'}} User.status 
 * @apiSuccess {String{'normal', 'bronzer','silver','gold'}} User.level
 * @apiSuccess {String} User.loginType now is github
 * @apiSuccess {String} User.githubId origin uid
 * @apiSuccess {String} [User.phone]
 * @apiSuccess {String} [User.mail]
 */
R.get('/detail', detail)

/**
 * @api {post} /user/detail/statistic userDailyStatistic
 * @apiDescription user detail info
 * @apiGroup user
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer} userId
 * 
 * @apiSuccess {StatT} Stat user statistic of all project
 */
R.post('/detail/statistic', getDailyStatistic)

R.post('/detail/withproject', detailWithProject)
R.post('/detail/withlimit', detailWithLimit)
R.post('/detail/status', getStatus)
R.post('/detail/level', getLevel)

if (process.env.NODE_ENV === 'dev') {
    R.post('/create', newUser)
    R.post('/update/level', updateLevel)
}

// job service will invoke this api
R.post('/update/status', updateStatus)
R.get('/list', getAllUser)
 
export default R.routes()
