import { Resp, NextT, KCtxT, Code, Msg, isErr, randomId, getAppLogger } from '@elara/lib'
import Router from 'koa-router'
import Passport from '../lib/passport'
import Account from '../service/account'
import Conf from '../../config'


const R = new Router()
const log = getAppLogger('account')
const accountConf = Conf.getAccount()

async function login(ctx: KCtxT, next: NextT) {
    if (ctx.isAuthenticated()) {
        const account = await Account.detail(ctx.state.user)
        ctx.response.body = Resp.Ok(account.value)
    } else {
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}

async function github(ctx: KCtxT, next: NextT) {
    return Passport.authenticate('github', { scope: ['user']})(ctx, next)
}

async function githubCallback(ctx: KCtxT, next: NextT) {
    return Passport.authenticate(
        'github',
        { scope: ['user'] },
        async (error: Error, user: any) => {
            if (error || user == null) {
                log.error('github callback error: ', error)
                ctx.response.redirect(accountConf.loginUrl)
                return next()
            }

            if (user.profile == null || user.profile.id == null) {
                ctx.response.redirect(accountConf.loginUrl)
                return next()
            }

            const uid = user.profile.id
            const re = await Account.detail(uid)
            const sid = randomId(24)

            if (isErr(re) || re.value.uid === uid) {
                const username = user.profile.username
                let account = await Account.create(
                    uid,
                    username,
                    0,
                    'github',
                )
                if (isErr(account)) {
                    //新建账户失败，重定向到登陆页
                    ctx.response.redirect(accountConf.loginUrl) //重定向到登陆页
                    return next()
                }
            }
            ctx.login(uid) //设置登陆
            ctx.session['sid'] = sid

            ctx.response.type = 'html'
            ctx.response.body = html_login_success
            return next()
        }
    )(ctx, next)
}

async function logout(ctx: KCtxT, next: NextT) {
    ctx.logOut()
    ctx.response.body = Resp.Ok().toString()
    return next()
}

async function updateStatus(ctx: KCtxT, next: NextT) {
    ctx.body = Resp.Ok()
    return next()
}

async function detail(ctx: KCtxT, next: NextT) {
    ctx.body = Resp.Ok()
    return next()
}

async function checkLimit(ctx: KCtxT, next: NextT) {
    log.debug('check body: ', ctx.request.body)
    const {chain, pid} = ctx.request.body
    log.debug('new limit check: ', chain, pid)
    const re = await Account.checkLimit(chain, pid)
    ctx.body = Resp.Ok(re)
    return next()
}


/// for local test
async function home(ctx: KCtxT, next: NextT) {
    ctx.response.type = 'html'
    ctx.response.body = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>patract.io 授权</title>
    </head>
    <body>
        <a href= '/auth/github'> 登录</a>
    </body>
    </html>`
    return next()
}

const html_login_success = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>patract.io 授权</title>
</head>
<body>
    授权成功
</body>
</html>`




R.get('/login', login)
R.get('/github', github)
R.get('/github/callback', githubCallback)
R.get('/logout', logout)
R.get('/github/home', home)
R.post('/status', updateStatus)
R.post('/info', detail)

R.post('/islimit', checkLimit)

export default R.routes()
