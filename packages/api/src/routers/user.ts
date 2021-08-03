import { Resp, NextT, KCtxT, Msg, isErr, getAppLogger } from '@elara/lib'
import Router from 'koa-router'
import User from '../service/user'
import { UserAttr, UserLevel, UserStat } from '../models/user'


const R = new Router()
const log = getAppLogger('user')

async function updateStatus(ctx: KCtxT, next: NextT) {
    const { status } = ctx.request.body
    if (!Object.values(UserStat).includes(status)) {
        throw Resp.Fail(400, 'invalid status' as Msg)
    }
    User.updateStatusByGit(ctx.state.user, status)
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
    const re = await User.findUserByGitWithProject(ctx.state.user)
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

R.post('/update/status', updateStatus)
R.post('/update/level', updateLevel)

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
R.post('/detail/withproject', detailWithProject)

R.post('/detail/status', getStatus)
R.post('/detail/level', getLevel)

R.post('/create', newUser)

R.get('/list', getAllUser)

export default R.routes()
