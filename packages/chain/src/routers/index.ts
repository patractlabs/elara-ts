import { isErr, KCtxT, NextT, Resp, RpcStrategy, Code, Msg } from '@elara/lib'
import { getAppLogger, ChainConfig } from '@elara/lib'
import Router from 'koa-router'
import Chain from '../services'

const R = new Router()
const log = getAppLogger('chain', true)

const chainList = async (ctx: KCtxT, next: NextT) => {
    const re = await Chain.chainList()
    if (isErr(re)) {
        throw Resp.Unknown()
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const detail = async (ctx: KCtxT, next: NextT) => {
    const chain = ctx.request.body.chain
    const re = await Chain.detail(chain)
    const cha = re.value
    log.debug('detail: ', cha)
    ctx.body = Resp.Ok(re.value)

    return next()
}

const addChain = async (ctx: KCtxT, next: NextT) => {
    const req: ChainConfig = ctx.request.body
    log.info('add body: ', req, req.baseUrl)
    if (await Chain.isExist(req.name)) {
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }
    req.baseUrl = '127.0.0.1'
    req.excludes = JSON.stringify(['system_call'])
    req.extends = JSON.stringify({ 'system_wtf': RpcStrategy.Abandon })
    const re = await Chain.newChain(req)
    if (isErr(re)) {
        throw Resp.Unknown()
    }
    ctx.body = Resp.Ok(req)
    return next()
}

const deleteChain = async (ctx: KCtxT, next: NextT) => {
    const chain = ctx.request.body.chain
    const re = await Chain.deleteChain(chain)
    if (isErr(re)) {
        throw Resp.Unknown()
    }
    ctx.body = Resp.Ok()
    return next()
}

const updateChain = async (ctx: KCtxT, next: NextT) => {
    const req = ctx.request.body
    const re = await Chain.updateChain(req)
    if (isErr(re)) {
        throw Resp.Unknown()
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

R.get('/list', chainList)
R.post('/detail', detail)
R.post('/add', addChain)
R.post('/delete', deleteChain)
R.post('/update', updateChain)

export default R.routes()