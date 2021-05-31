import { Resp, NextT, KCtxT, Code, Msg } from 'lib'
import Passport from '../lib/passport'
const Account = require('../service/account')
import { getID } from '../lib/tool'
import { setConfig } from '../../config'
const config = setConfig()

let login = async (ctx: KCtxT, next: NextT) => {


    if (ctx.isAuthenticated()) {
        ctx.response.body = Resp.Ok(Account.info(ctx.state.user)).toString()
    } else {
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return next()
}
let github = async (ctx: KCtxT, next: NextT) => {


    return Passport.authenticate('github')(ctx, next)
}
let callback = async (ctx: KCtxT, next: NextT) => {

    let passportAuth = Passport.authenticate(
        'github',
        { scope: ['user'] },
        async (error: Error, user: any) => {
            if (error || user == null) {
                console.log(error)
                ctx.response.redirect(config.login)
                return next()
            }

            if (user.profile == null || user.profile.id == null) {
                ctx.response.redirect(config.login)
                return next()
            }

            console.log(user)
            let sid = getID(24)
            let uid = user.profile.id
            let username = user.profile.username
            let account = await Account.info(uid)
            if (!account.isOk()) {
                account = await Account.create(
                    uid,
                    username,
                    config.defaultLevel,
                    'github'
                )
                if (account.isOk()) {
                    ctx.login(uid) //设置登陆
                    ctx.session['sid'] = sid
                } else {
                    //新建失败，重定向到登陆页
                    ctx.response.redirect(config.login) //重定向到登陆页
                    return next()
                }
            } else {
                ctx.session['sid'] = sid
                ctx.login(uid) //设置登陆
            }

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>patract.io 授权</title>
</head>
<body>
    授权成功
    <script>
        window.onload = function () {
        window.opener.postMessage("${sid}","https://elara.patract.io");
        window.close();
    }
    </script>
</body>
</html>`
            ctx.response.type = 'html'
            ctx.response.body = html
            return next()
        }
    )(ctx, next)

    return passportAuth
}

let logout = async (ctx: KCtxT, next: NextT) => {
    ctx.logOut()
    ctx.response.body = Resp.Ok().toString()
    if (ctx.state) {
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }
    return next()
}

let test_home = async (ctx: KCtxT, next: NextT) => {
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>patract.io 授权</title>
    </head>
    <body>
        <a href= '/test/github/login'> 登录</a>
    </body>
    </html>`
    ctx.response.type = 'html'
    ctx.response.body = html
    return next()
}

let test_login = async (ctx: KCtxT, next: NextT) => {
    let url =
        'https://github.com/login/oauth/authorize?client_id=d67ed989933a697a9f9e'
    ctx.redirect(url)
    return next()
}

module.exports = {
    'GET /auth/login': login, //登录信息
    'GET /auth/github': github, //github验证
    'GET /auth/github/callback': callback, //github 验证回调
    'GET /auth/logout': logout, //退出登录

    'GET /test/github/login': test_login, //访问github授权页
    'GET /test/github/home': test_home,
}
