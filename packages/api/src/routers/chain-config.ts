
import Router from 'koa-router'
import { KCtxT, NextT, Resp } from "@elara/lib"
import ChainConfig from "../service/chain-config"

const R = new Router()

async function add(ctx: KCtxT, next: NextT) {
    ChainConfig.add()
    ctx.body = Resp.Ok()
    return next()
}

async function deleteChainConf(ctx: KCtxT, next: NextT) {
    // ChainConfig.delete()
    ctx.body = Resp.Ok()
    return next()
}


R.post('/config/add', add)
R.post('/config/delete', deleteChainConf)


export default R.routes()