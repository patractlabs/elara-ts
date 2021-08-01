import { Resp, NextT, KCtxT, Msg, isErr, getAppLogger } from '@elara/lib'
import Router from 'koa-router'
import User from '../service/user'
import { UserAttr, UserLevel, UserStat } from '../model/user'


const R = new Router()
const log = getAppLogger('account')

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
    // log.debug('level keys: ', Object.keys(UserLevel))
    if (!Object.values(UserLevel).includes(level)) {
        throw Resp.Fail(400, 'invalid level' as Msg)
    }
    User.updateLevelByGit(ctx.state.user, level)
    ctx.body = Resp.Ok()
    return next()
}

async function detail(ctx: KCtxT, next: NextT) {
    log.debug('context state user: ', ctx.state.user)
    const re = await User.findUserByGit(ctx.state.user)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function getStatus(ctx: KCtxT, next: NextT) {
    const re = await User.getStatusByGit(ctx.state.user)
    log.debug('get status result: ', re)
    ctx.body = Resp.Ok(re)
    return next()
}

async function getLevel(ctx: KCtxT, next: NextT) {
    const re = await User.getLevelByGit(ctx.state.user)
    log.debug('get level result: ', re)
    ctx.body = Resp.Ok(re)
    return next()
}

async function checkLimit(ctx: KCtxT, next: NextT) {
    log.debug('check body: ', ctx.request.body)
    const { chain, pid } = ctx.request.body
    log.debug('new limit check: ', chain, pid)
    const re = await User.checkLimit(chain, pid)
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

R.post('/status', updateStatus)
R.post('/level', updateLevel)
R.post('/detail', detail)
R.post('/detail/status', getStatus)
R.post('/detail/level', getLevel)

R.post('/islimit', checkLimit)

R.post('/', newUser)

export default R.routes()
