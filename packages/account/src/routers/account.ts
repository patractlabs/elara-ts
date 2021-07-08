import { Resp, NextT, KCtxT } from "elara-lib";

async function login(ctx: KCtxT, next: NextT) {
    // TODO:
    if (ctx.isAuthenticated()) {}
    ctx.response.body = Resp.Ok().toString();
    return next();
}
let github = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString();

    return next();
};
let callback = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString();
    return next();
};
let logout = async (ctx: KCtxT, next: NextT) => {
    ctx.response.body = Resp.Ok().toString();
    return next();
};

module.exports = {
    "GET /auth/login": login, //登录信息
    "GET /auth/github": github, //github验证
    "GET /auth/github/callback": callback, //github 验证回调
    "GET /auth/logout": logout, //退出登录
};
