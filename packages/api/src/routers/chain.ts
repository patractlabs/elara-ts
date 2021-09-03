import { isErr, KCtxT, NextT, Resp, } from '@elara/lib'
import { getAppLogger, Code, Msg } from '@elara/lib'
import Router from 'koa-router'
import { lengthOk } from '../lib'
import { ChainAttr } from '../models/chain'
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
    const { userId } = ctx.request.body
    if (userId === undefined) {
        throw Resp.Fail(400, 'invalid userId' as Msg)
    }
    const re = await Chain.chainsInfoList(userId)
    if (isErr(re)) {
        throw Resp.Fail(400, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

const addChain = async (ctx: KCtxT, next: NextT) => {
    const { name, team, network } = ctx.request.body
    if (!name || !network || !team) {
        throw Resp.Fail(400, 'invalid params' as Msg)
    }

    checkName(name)

    const re = await Chain.newChain({name: name.toLowerCase(), team, network} as ChainAttr)
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
    const re = await Chain.deleteChain(id, name.toLowerCase(), force)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

/**
 *
 * @api {post} /chain/list list
 * @apiGroup chain
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Integer} userId 
 * 
 * @apiSuccess {Object} Record chain list map by network,Record<String, ChainInfo[]>
 * @apiSuccessExample Success:
 *  {
 *      code: 0,
 *      msg: 'ok',
 *      data: { 
 *          'live': [{
 *              id: 1,
 *              name: 'polkadot',
 *              team: 'parity',
 *              network: 'Polkadot',
 *              status: 'active',   'active' | 'inactive' | 'empty'
 *              count: 1    // project count
 * 
 *          }, {}],
 *          'test': []
 *      }
 *  }
 */
R.post('/list', chainList)
R.post('/add', addChain)
R.post('/delete', deleteChain)
// if (process.env.NODE_ENV === 'dev') {
//     R.post('/add', addChain)
//     R.post('/delete', deleteChain)
// }

export default R.routes()