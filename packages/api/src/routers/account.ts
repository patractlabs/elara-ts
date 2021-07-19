import { Resp, NextT, KCtxT, Code, Msg, isErr, randomId } from '@elara/lib'
import Router from 'koa-router'
import Passport from '../lib/passport'
import Account from '../service/account'
import Conf from '../../config'

const accountConf = Conf.getAccount()

let login = async (ctx: KCtxT, next: NextT) => {
    if (ctx.isAuthenticated()) {
        const account = await Account.detail(ctx.state.user)
        ctx.response.body = Resp.Ok(account.value)
    } else {
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}

let github = async (ctx: KCtxT, next: NextT) => {
    return Passport.authenticate('github')(ctx, next)
}

let callback = async (ctx: KCtxT, next: NextT): Promise<NextT> => {
    let passportAuth = Passport.authenticate(
        'github',
        { scope: ['user'] },
        async (error: Error, user: any) => {
            if (error || user == null) {
                console.log(error)
                ctx.response.redirect(accountConf.loginUrl)
                return next()
            }

            if (user.profile == null || user.profile.id == null) {
                ctx.response.redirect(accountConf.loginUrl)
                return next()
            }

            const uid = user.profile.id
            const account = await Account.detail(uid)
            const sid = randomId(24)
            if (account.value != null) {
                // 已存在账户
                ctx.login(uid) //设置登陆
                ctx.session['sid'] = sid
            } else {
                // 创建账户
                const username = user.profile.username
                let account = await Account.create(
                    uid,
                    username,
                    accountConf.defaultLevel,
                    'github',
                    accountConf.apiKey
                    
                )
                if (isErr(account)) {
                    //新建账户失败，重定向到登陆页
                    ctx.response.redirect(accountConf.loginUrl) //重定向到登陆页
                    return next()
                }
                ctx.login(uid) //设置登陆
                ctx.session['sid'] = sid
            }

            ctx.response.type = 'html'
            ctx.response.body = html_login_succecc
            return next()
        }
    )(ctx, next)
    return passportAuth
}

let logout = async (ctx: KCtxT, next: NextT) => {
    ctx.logOut()
    ctx.response.body = Resp.Ok().toString()
    return next()
}

let home = async (ctx: KCtxT, next: NextT) => {
    ctx.response.type = 'html'
    ctx.response.body = html_home
    return next()
}

const html_home = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>patract.io 授权</title>
    </head>
    <body>
        <a href= '/account/auth/github'> 登录</a>
    </body>
    </html>`

const html_login_succecc = `
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



const R = new Router()

R.get('/login', login)
R.get('/github', github)
R.get('/github/callback', callback)
R.get('/logout', logout)
R.get('/github/home', home)

export default R.routes()
