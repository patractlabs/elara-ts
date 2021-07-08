import { Context as KCtx } from "koa";
import Router from "koa-router";

const router = new Router();

router.get("/hello", (ctx: KCtx) => {
    console.log("world");
    ctx.response.body = "Hello world";
});

export = router.routes();
