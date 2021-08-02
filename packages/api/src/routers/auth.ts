import Router from 'koa-router'
import { KCtxT, NextT, getAppLogger, Resp, Code, Msg, randomId, isErr } from '@elara/lib'
import User from '../service/user'
import { UserAttr, LoginType } from '../models/user'
import Passport from '../lib/passport'
import Conf from '../../config'

const R = new Router()
const log = getAppLogger('auth')

const userConf = Conf.getUser()

async function login(ctx: KCtxT, next: NextT) {
    if (ctx.isAuthenticated()) {
        const user = await User.findUserByGit(ctx.state.user)
        ctx.response.body = Resp.Ok(user.value)
    } else {
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}

async function github(ctx: KCtxT, next: NextT) {
    return Passport.authenticate('github', { scope: ['user'] })(ctx, next)
}

async function githubCallback(ctx: KCtxT, next: NextT) {
    return Passport.authenticate(
        'github',
        { scope: ['user'] },
        async (error: Error, user: any) => {
            if (error || user == null) {
                log.error('github callback error: ', error)
                ctx.response.redirect(userConf.loginUrl)
                return next()
            }

            if (user.profile == null || user.profile.id == null) {
                ctx.response.redirect(userConf.loginUrl)
                return next()
            }

            const githubId = user.profile.id
            const re = await User.findUserByGit(githubId)
            const sid = randomId(24)

            if (isErr(re) || re.value.githubId === githubId) {
                const name = user.profile.username
                let cuser = await User.create({
                    githubId,
                    name,
                    loginType: LoginType.Github
                } as UserAttr)
                if (isErr(cuser)) {
                    //新建账户失败，重定向到登陆页
                    ctx.response.redirect(userConf.loginUrl) //重定向到登陆页
                    return next()
                }
            }
            ctx.login(githubId) //设置登陆
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
R.get('/logout', logout)
R.get('/github', github)
R.get('/github/callback', githubCallback)
R.get('/github/home', home)

export default R.routes()