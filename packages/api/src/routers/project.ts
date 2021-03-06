import Project from '../service/project'
import { ProAttr, ProStatus } from '../models/project'
import { KCtxT, NextT, getAppLogger, Code, Resp, Msg, PVoidT } from '@elara/lib'
import { isErr, isEmpty } from '@elara/lib'
import { lengthOk } from '../lib'
import Router from 'koa-router'
import User from '../service/user'
import Chain from '../service/chain'
import UserModel from '../models/user'

const R = new Router()
const log = getAppLogger('project')

function checkName(name: string): void {
    const regOk = /[a-zA-Z0-9]/.test(name)  // not invalid
    const lenOk = lengthOk(name, 4, 32)
    log.debug(`name check result: ${regOk} ${lenOk}`)
    if (!lenOk || !regOk) {
        log.error(`Project name invalid or empty, name[${name}]`)
        throw Resp.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
    }
}

function checkChainPid(chain: string, pid: string): void {
    if (isEmpty(chain) || isEmpty(pid)) {
        log.error(`chain and project id cannot be null`)
        throw Resp.Fail(Code.Pro_Update_Err, 'chain and project id cannot be null' as Msg)
    }
}

function checkStatus(status: ProStatus): void {
    if (!Object.values(ProStatus).includes(status)) {
        log.error(`invalid status: ${status}`)
        throw Resp.Fail(Code.Pro_Update_Err, 'invalid status' as Msg)
    }
}

async function checkProjectLimit(userId: number): PVoidT {
    let cntRe = await Project.countOfUser(userId)
    if (isErr(cntRe)) {
        log.error(`fetch uid[${userId}] total created project num error: ${cntRe}`)
        throw Resp.Fail(Code.Pro_Num_Limit, cntRe.value as Msg)
    }

    const cnt = cntRe.value as number
    const isOutofLimit = await User.projectCreateOutLimit(userId, cnt)
    if (isOutofLimit) {
        log.error('Out of max project create number!')
        throw Resp.Fail(Code.Pro_Num_Limit, Msg.Pro_Num_Limit)
    }
}

async function create(ctx: KCtxT, next: NextT) {
    const uid = ctx.state.user
    log.debug('create project request: %o %o', uid, ctx.request.body)
    let { userId, name, chain, reqDayLimit, reqSecLimit, bwDayLimit } = ctx.request.body

    if (!userId || !chain || !name) {
        throw Resp.Fail(400, 'invalid params' as Msg)
    }

    checkName(name)

    const cre = await Chain.findByName(chain)
    if (isErr(cre)) {
        throw Resp.Fail(400, 'Invalid chain' as Msg)
    }
    const cconf = cre.value

    const isExist = await Project.isExist(userId, chain, name)
    if (isExist) {
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }

    await checkProjectLimit(userId)

    const lre = await User.findUserByIdwithLimit(userId)
    if (isErr(lre)) {
        log.error(lre.value)
    } else {
        reqDayLimit = reqDayLimit ?? -1
        reqSecLimit = reqSecLimit ?? -1
        bwDayLimit = bwDayLimit ?? -1
        // limit
        const limit = (lre.value as UserModel).limit
        if (limit) {
            if (reqDayLimit > limit.reqDayLimit) { reqDayLimit = limit.reqDayLimit }
            if (reqSecLimit > limit.reqSecLimit) { reqSecLimit = limit.reqSecLimit }
            if (bwDayLimit > limit.bwDayLimit) { bwDayLimit = limit.bwDayLimit }
        }
    }

    const attr = {
        userId,
        name,
        chain,
        team: cconf.team,
        network: cconf.network,
        reqSecLimit,
        reqDayLimit,
        bwDayLimit
    } as ProAttr

    const re = await Project.create(attr)

    if (isErr(re)) {
        log.debug('create project error: %o', re.value)
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }

    log.info('create project result: %o', re)

    ctx.body = Resp.Ok(re.value)   // equals to ctx.response.body
    return next()
}

async function findById(ctx: KCtxT, next: NextT) {
    const { id } = ctx.request.body
    if (!Number.isInteger(id)) {
        throw Resp.Fail(400, 'must be integer' as Msg)
    }
    const re = await Project.findById(id)
    if (isErr(re)) {
        throw Resp.Fail(500, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function findByChainPid(ctx: KCtxT, next: NextT) {
    const { chain, pid } = ctx.request.body
    log.debug('get project detail: %o %o', chain, pid)
    checkChainPid(chain, pid)

    let project = await Project.findByChainPid(chain, pid)
    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Resp.Ok(project.value)
    return next()
}

// project count list of chain by user
async function countOfChain(ctx: KCtxT, next: NextT) {
    const { chain } = ctx.request.body
    log.debug(`count of ${chain} params: %o`, ctx.request.body)
    let re = await Project.countOfChain(chain)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function countOfUser(ctx: KCtxT, next: NextT) {
    let { userId, byChain } = ctx.request.body
    if (byChain !== true) { byChain = false }
    let cntRe = await Project.countOfUser(userId, byChain)
    if (isErr(cntRe)) {
        log.error(`fetch user[${userId}] total created project num error: %o`, cntRe.value)
        throw Resp.Fail(Code.Pro_Num_Limit, cntRe.value as Msg)
    }
    ctx.body = Resp.Ok(cntRe.value)
    return next()
}

async function listWithStatus(ctx: KCtxT, next: NextT) {
    const { userId, chain } = ctx.request.body
    log.debug(`get ${chain} project list with status of user: ${userId}`)
    if (!Number.isInteger(userId)) {
        throw Resp.Fail(400, 'userId must be integer' as Msg)
    }
    let re = await Project.listWithStatusByUser(userId, chain)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function updateStatus(ctx: KCtxT, next: NextT) {
    const { id, status } = ctx.request.body as ProAttr
    if (status) { checkStatus(status) }
    const re = await Project.update({ id, status } as ProAttr)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(status)
    return next()
}

async function updateLimit(ctx: KCtxT, next: NextT) {
    let { id, reqSecLimit, reqDayLimit, bwDayLimit } = ctx.request.body
    // if (!Number.isInteger(id)) {
    //     throw Resp.Fail(400, 'project id must be integer' as Msg)
    // }
    const pro = { id } as ProAttr
    if (reqSecLimit) {
        if (!Number.isInteger(reqSecLimit)) {
            throw Resp.Fail(400, 'second request limit must be integer' as Msg)
        }
        reqSecLimit = reqSecLimit < 0 ? -1 : reqSecLimit
        pro.reqSecLimit = reqSecLimit
    }
    if (reqDayLimit) {
        if (!Number.isInteger(reqDayLimit)) {
            throw Resp.Fail(400, 'daily request limit must be integer' as Msg)
        }
        reqDayLimit = reqDayLimit < 0 ? -1 : reqDayLimit
        pro.reqDayLimit = reqDayLimit
    }
    if (bwDayLimit) {
        if (!Number.isInteger(bwDayLimit)) {
            throw Resp.Fail(400, 'daily bandwidth limit must be integer' as Msg)
        }
        bwDayLimit = bwDayLimit < 0 ? -1 : bwDayLimit
        pro.bwDayLimit = bwDayLimit
    }

    const re = await Project.updateLimit(pro)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok()
    return next()
}

async function updateName(ctx: KCtxT, next: NextT) {
    const { userId, id, chain, name } = ctx.request.body
    checkName(name)
    const isExist = await Project.isExist(userId, chain, name)
    if (isExist) {
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }
    const re = await Project.update({ id, name } as ProAttr)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(name)
    return next()
}

async function deleteProject(ctx: KCtxT, next: NextT) {
    let { id, force } = ctx.request.body
    if (force !== true) { force = false }
    const re = await Project.delete(id, force)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

/**
 * @apiDefine UserNotFoundError
 *
 * @apiError UserNotFound The id of the User was not found.
 *
 * @apiErrorExample Error-Response:

 *     {
 *       "error": "UserNotFound"
 *     }
 * 
 */

/**
 * @api {post} /project/list list
 * @apiDescription  get project list according to [userId, chain], 
 * if both, list of userId & chain
 * @apiGroup project
 * @apiVersion 0.1.0
 * 
 * @apiParam {Number} [userId]  integer userId, list of userId
 * 
 * @apiSuccess {ProAttr[]} project list of project
 * @apiSuccess {Number} project.id project id, integer
 * @apiSuccess {String} project.pid project pid, 16 bytes hex string
 * @apiSuccess {String} project.name project name
 * @apiSuccess {String} project.status project status ['active', 'stop', 'suspend']
 * @apiSuccess {String} project.chain chain name
 * @apiSuccess {String} project.team team name
 * @apiSuccess {String} project.secret project secret, reserved field
 * @apiSuccess {Number} project.userId association user id
 * @apiSuccess {Number} project.reqSecLimit request count of second limit
 * @apiSuccess {Number} project.reqDayLimit request count of day limit
 * @apiSuccess {Number} project.bwDayLimit bandwidth of day limit
 * 
 * @apiSuccessExample Success:
 *  {
 *      code: 0,
 *      msg: 'ok',
 *      data: ProAttr[]
 *  }
 * @apiErrorExample Error:
 * {
 *      code: 400,  // non 0 code
 *      msg: error message,
 *      data: {}
 * }
 * 
 * @apiSampleRequest off
 */
R.post('/list', listWithStatus)

/**
 * @api {post} /project/count/chain countOfChain
 * @apiVersion 0.1.0
 * @apiGroup project
 * @apiSampleRequest off
 * 
 * @apiParam {String} chain chain name
 * 
 * @apiSuccess {Number} none  count of chain
 * 
 */
R.post('/count/chain', countOfChain)

/**
 * @api {post} /project/count/user countOfUser
 * @apiVersion 0.1.0
 * @apiGroup project
 * @apiSampleRequest off
 * 
 * @apiParam {Number} userId user id
 * @apiParam {Boolean} byChain by chain or not
 * 
 * @apiSuccess {Number} none  count of user
 * @apiSuccess {Object[]} Counts count list of user & chain
 * @apiSuccess {String} Counts.chain    chain
 * @apiSuccess {String} Counts.count    count of chain
 * @apiSuccessExample SuccessByChain:
 * {
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "chain": "Kusuma",
      "count": "2"
    },
    {
      "chain": "jupiter",
      "count": "2"
    }
  ]
}
 *
 * @apiSuccessExample Success:
 * {
 *      code: 0,
 *      msg: 'ok',
 *      data: 4
 * }
 * 
 */
R.post('/count/user', countOfUser)

/**
 * @api {post} /project/detail/chainpid projectByChainPid
 * @apiVersion 0.1.0
 * @apiGroup project
 * @apiSampleRequest off
 * 
 * @apiParam {String} chain
 * @apiParam {String} pid
 * 
 * @apiSuccess {ProAttr} project
 */
R.post('/detail/chainpid', findByChainPid)

/**
 * @api {post} /project/detail/id projectById
 * @apiVersion 0.1.0
 * @apiGroup project
 * @apiSampleRequest off
 * 
 * @apiParam {Number} id
 * 
 * @apiSuccess {ProAttr} project
 */
R.post('/detail/id', findById)


/**
 *
 * @api {post} /project/update/name updateName
 * @apiGroup project
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Number} userId
 * @apiParam {String} chain which chain belongs to
 * @apiParam {Number} id    project id
 * @apiParam {String} name  new project name
 * 
 * @apiSuccess {String} none new name
 */
R.post('/update/name', updateName)

/**
 *
 * @api {post} /project/update/limit/ updateLimit
 * @apiDescription udpate project resource limit, reqSecLimit/reqDayLimit/bwDayLimit
 * @apiGroup project
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Number} id  project id
 * @apiParam {Number} [reqSecLimit]  request second limit
 * @apiParam {Number} [reqDayLimit]  request day limit
 * @apiParam {Number} [bwDayLimit]   bandwidth day limit
 *
 * @apiSuccess {null} none
 */
R.post('/update/limit', updateLimit)

/**
 *
 * @api {post} /project/create create
 * @apiGroup project
 * @apiVersion  0.1.0
 * @apiSampleRequest off
 * 
 * @apiParam {Number} userId  user id
 * @apiParam {String} chain   chain
 * @apiParam {String} team    team name
 * @apiParam {String} name    project name to create [0-9a-zA-Z]{4,32}
 * @apiParam {Number} [reqSecLimit] request second limit
 * @apiParam {Number} [reqDayLimit] request day limit
 * @apiParam {Number} [bwDayLimit]  bandwidth day limit
 * 
 * @apiSuccess {ProAttr} none  project created
 */
R.post('/create', create)

/**
*
* @api {post} /project/delete delete
* @apiDescription logic delete
* @apiGroup project
* @apiVersion  0.1.0
* @apiSampleRequest off
* 
* @apiParam {Number} id  project id
* 
* @apiSuccess {Boolean} none delte result, success or not
*/
R.post('/delete', deleteProject)

// for job service
R.post('/update/status', updateStatus)

export default R.routes()