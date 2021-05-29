import { isErr, KCtxT, NextT, Resp, RpcStrategy, Code, Msg } from 'lib'
import { getAppLogger, ChainConfig } from 'lib'
import Chain from '../services'

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
    const cha: ChainConfig = re.value
    log.info('detail: ', cha)
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
    req.extends = JSON.stringify({'system_wtf': RpcStrategy.Abandon})
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

module.exports = {
    'GET /chain/list': chainList,
    'POST /chain/detail': detail,
    'POST /chain/add': addChain,
    'POST /chain/delete': deleteChain,
    'POST /chain/update': updateChain,
}