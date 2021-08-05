import { isErr, KCtxT, NextT, Resp, } from '@elara/lib'
import { getAppLogger, Code, Msg } from '@elara/lib'
import Router from 'koa-router'
import { lengthOk } from '../lib'
import { ChainAttr, Network } from '../models/chain'
import Chain from '../service/chain'

const R = new Router()
const log = getAppLogger('chain')
function checkName(name: string): void {
    const regOk = /[a-zA-Z0-9]/.test(name)  // not invalid
    const lenOk = lengthOk(name, 4, 32)
    log.debug(`name check result: ${regOk} ${lenOk}`)
    if (!lenOk || !regOk) {
        log.error(`Project name invalid or empty, name[${name}]`)
        throw Resp.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
    }
}
const chainList = async (ctx: KCtxT, next: NextT) => {
    const re = await Chain.chainList()
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const findByName = async (ctx: KCtxT, next: NextT) => {
    const { name } = ctx.request.body
    const re = await Chain.findByName(name)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const findById = async (ctx: KCtxT, next: NextT) => {
    const { id } = ctx.request.body
    if (!Number.isInteger(id)) {
        throw Resp.Fail(400, 'id must be integer' as Msg)
    }
    const re = await Chain.findById(id)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const addChain = async (ctx: KCtxT, next: NextT) => {
    const req: ChainAttr = ctx.request.body
    log.debug('add Chain request: %o', req)
    const { name, team, network } = ctx.request.body
    if (!name || !network || !team || !name) {
        throw Resp.Fail(400, 'invalid params' as Msg)
    }

    checkName(name)
    checkName(team)

    const re = await Chain.newChain(req)
    if (isErr(re)) {
        log.debug('add Chain error: %o', re.value)
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    log.info('add Chain result: %o', re)
    ctx.body = Resp.Ok(re.value)
    return next()
}

const deleteChain = async (ctx: KCtxT, next: NextT) => {
    let { id, name, force } = ctx.request.body
    if (force !== true) { force = false }
    const re = await Chain.deleteChain(id, name, force)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const findChainsByNetwork = async (ctx: KCtxT, next: NextT) => {
    const { network } = ctx.request.body

    checkNetwork(network)
    const re = await Chain.findByNetwork(network)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

function checkNetwork(network: Network): void {
    if (!Object.values(Network).includes(network)) {
        log.error(`invalid network: ${network}`)
        throw Resp.Fail(Code.Chain_Err, 'invalid network' as Msg)
    }
}

/**
 *
 * @api {get} /chain/list list
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiSuccess {Object} Record chain list map by network,Record<String, ChainAttr[]>
 * @apiSuccessExample Success:
 *  {
 *      code: 0,
 *      msg: 'ok',
 *      data: { 
 *          'live': [{}, {}],
 *          'test': []
 *      }
 *  }
 */
R.get('/list', chainList)


/**
 *
 * @api {post} /chain/list/bynetwork bynetwork
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} [network]   chain network, list of network ['test', 'live', 'polkadot','kusama','westend','rococo']
 * 
 * @apiSuccess {ChainAttr[]} chain list of chain
 * @apiSuccess {Number} chain.id chain id, integer
 * @apiSuccess {String} chain.name chain name
 * @apiSuccess {String} chain.team chain team
 * @apiSuccess {String} chain.network chain network ['test', 'live', 'polkadot','kusama','westend','rococo']
 * @apiSuccessExample Success:
 *  {
 *      code: 0,
 *      msg: 'ok',
 *      data: ChainAttr[]
 *  }
 */
R.post('/list/bynetwork', findChainsByNetwork)

R.post('/add', addChain)

R.post('/delete', deleteChain)

/**
 * @api {post} /chain/detail/byname findByName
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiSuccess {ChainAttr} chain
 */
R.post('/detail/byname', findByName)

/**
 * @api {post} /chain/detail/byid findById
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiSuccess {ChainAttr} chain
 * @apiSuccess {Number} chain.id chain id, integer
 * @apiSuccess {String} chain.name chain name
 * @apiSuccess {String} chain.team chain team
 * @apiSuccess {String} chain.network chain network ['test', 'live', 'polkadot','kusama','westend','rococo']
 *
 */
R.post('/detail/byid', findById)

export default R.routes()