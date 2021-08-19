import Router from "koa-router";
import {
    KCtxT,
    NextT,
    getAppLogger,
    Resp,
    Code,
    Msg,
    randomId,
    isErr,
} from "@elara/lib";
import User from "../service/user";
import { UserAttr, LoginType } from "../models/user";
import Passport from "../lib/passport";
import Conf from "../../config";
import Project from "../service/project";

const R = new Router();
const log = getAppLogger("auth");

const userConf = Conf.getUser();

/**
 *
 * @api {get} /auth/login login
 * @apiGroup auth
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiSuccess {Object} User user obeject with limit resource and project count
 * @apiSuccessExample Success
 * {
 *      code: 0,
 *      msg: 'ok',
 *      data: {
 *          user: {
 *              id: 1,
 *              name: 'Bruce',
 *              githubId: 'TestUID',
 *              limit: {
 *                  projectNum: 10, // max prject count
 *                  bwDayLimit,
 *                  reqDayLimit,
 *                  ...
 *              }
 *          },
 *          projectNum: 7
 *      }
 * }
 */
async function login(ctx: KCtxT, next: NextT) {
    if (ctx.isAuthenticated()) {
        const ure = await User.findUserByGitwithLimit(ctx.state.user);
        if (isErr(ure)) {
            throw Resp.Fail(500, ure.value as Msg)
        }
        const user = ure.value
        user.id = parseInt(user.id.toString())
        // project count
        const cntre = await Project.countOfUser(user.id)
        if (isErr(cntre)) {
            log.error('user login get project count error: %o', cntre.value)
            throw Resp.Fail(500, cntre.value as Msg)
        }
        ctx.response.body = Resp.Ok({user, projectNum: cntre.value as Number});
    } else {
        throw Resp.Fail(Code.Auth_Fail, Msg.Auth_Fail);
    }
    return next();
}

/**
 *
 * @api {get} /auth/github github
 * @apiDescription clientID，clientSecret，access GitHub
 * @apiGroup auth
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 */

async function github(ctx: KCtxT, next: NextT) {
    return Passport.authenticate("github", { scope: ["user"] })(ctx, next);
}

async function githubCallback(ctx: KCtxT, next: NextT) {
    return Passport.authenticate(
        "github",
        { scope: ["user"] },
        async (error: Error, user: any) => {
            if (user == null || user.id == null || error) {
                log.error("github callback error: ", error);
                ctx.response.redirect(userConf.loginUrl);
                return next();
            }

            const githubId = user.id;
            const re = await User.findUserByGit(githubId);
            const sid = randomId(24);
            const userModel = re as unknown as UserAttr;
            if (userModel != null) {
                //存在用户
                //设置登陆
                ctx.login(githubId);
                ctx.session["sid"] = sid;
            }

            if (isErr(re)) {
                const name = user.username;
                let cuser = await User.create({
                    githubId,
                    name,
                    loginType: LoginType.Github,
                } as UserAttr);

                if (isErr(cuser)) {
                    //新建用户失败，重定向到登陆页
                    //重定向到登陆页
                    ctx.response.redirect(userConf.loginUrl);
                    return next();
                }
                ctx.login(githubId);
                ctx.session["sid"] = sid;
            }

            ctx.response.type = "html";
            ctx.response.body = html_login_success;
            // ctx.response.redirect(userConf.loginUrl)
            return next();
        }
    )(ctx, next);
}

/**
 *
 * @api {get} /auth/logout logout
 * @apiGroup auth
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 */
async function logout(ctx: KCtxT, next: NextT) {
    ctx.logOut();
    ctx.response.body = Resp.Ok().toString();
    return next();
}

/// for local test
async function home(ctx: KCtxT, next: NextT) {
    ctx.response.type = "html";
    ctx.response.body = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>patract.io 授权</title>
    </head>
    <body>
        <a href= '/api/auth/github'> 登录</a>
    </body>
    </html>`;
    return next();
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
    <script>
        window.onload = function () {
        window.close();
    }
    </script>
</body>
</html>`

R.get("/login", login);
R.get("/logout", logout);
R.get("/github", github);
R.get("/github/callback", githubCallback);
R.get("/github/home", home);

export const authRouter = R.routes();
