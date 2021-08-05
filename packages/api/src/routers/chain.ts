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
        throw Resp.Unknown()
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const detail = async (ctx: KCtxT, next: NextT) => {
    const chain = ctx.request.body.chain
    const re = await Chain.detail(chain)
    const cha = re.value
    log.debug('detail: %o', cha)
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
    ctx.body = Resp.Ok(req)
    return next()
}

const deleteChain = async (ctx: KCtxT, next: NextT) => {
    const name = ctx.request.body.name
    const re = await Chain.deleteChain(name, true)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
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

const findChainsByNetwork = async (ctx: KCtxT, next: NextT) => {
    const network = ctx.request.body.network

    if (network) { checkNetwork(network) }
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

/**
 *
 * @api {post} /chain/add add
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} [network]   chain network, list of network ['test', 'live', 'polkadot','kusama','westend','rococo']
 * @apiParam {String} team    team name
 * @apiParam {String} name   chain name
 * 
 * @apiSuccess {ChainAttr[]} chain list of chain
 * @apiSuccess {Number} chain.id chain id, integer
 * @apiSuccess {String} chain.name chain name
 * @apiSuccess {String} chain.team chain team
 * @apiSuccess {String} chain.network chain network ['test', 'live', 'polkadot','kusama','westend','rococo']
 *
 */
R.post('/add', addChain)

/**
 *
 * @api {post} /chain/delete delete
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {String} name   chain name
 * 
 *
 */
R.post('/delete', deleteChain)

R.post('/detail', detail)
R.post('/update', updateChain)

export default R.routes()