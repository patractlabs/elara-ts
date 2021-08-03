import Project from '../service/project'
import { ProAttr, ProStatus } from '../models/project'
import { KCtxT, NextT, getAppLogger, Code, Resp, Msg, PVoidT } from '@elara/lib'
import { isErr, isEmpty } from '@elara/lib'
import { lengthOk } from '../lib'
import Router from 'koa-router'
import User from '../service/user'

const R = new Router()
const log = getAppLogger('project', true)

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
    log.debug('create project request: ', uid, ctx.request.body)
    const {userId, name, chain, team, reqDayLimit, reqSecLimit, bwDayLimit} = ctx.request.body

    if (!userId || !chain || !team || !name) {
        throw Resp.Fail(400, 'invalid params' as Msg)
    }

    checkName(name)

    const isExist = await Project.isExist(userId, chain, name)
    if (isExist) {
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }

    await checkProjectLimit(userId)

    const attr = {
        userId,
        name,
        chain,
        team,
        reqSecLimit: reqSecLimit ?? -1, // project limit up to user level
        reqDayLimit: reqDayLimit ?? -1,
        bwDayLimit: bwDayLimit ?? -1
    } as ProAttr
    
    const re = await Project.create(attr)

    if (isErr(re)) {
        log.debug('create project error: ', re.value)
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }

    log.info('create project result: ', re)

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
    log.debug('get project detail: ', chain, pid)
    checkChainPid(chain, pid)

    let project = await Project.findByChainPid(chain, pid)
    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Resp.Ok(project.value)
    return next()
}

async function statusByChainPid(ctx: KCtxT, next: NextT) {
    let { chain, pid, includeUser } = ctx.request.body
    log.debug('get project detail: ', chain, pid)
    checkChainPid(chain, pid)
    if (includeUser !== true) { includeUser = false}
    let project = await Project.statusByChainPid(chain, pid, includeUser)
    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Resp.Ok(project.value)
    return next()
}

// project count list of chain by user
async function countOfChain(ctx: KCtxT, next: NextT) {
    const { chain } = ctx.request.body
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
        log.error(`fetch user[${userId}] total created project num error: ${cntRe}`)
        throw Resp.Fail(Code.Pro_Num_Limit, cntRe.value as Msg)
    }
    ctx.body = Resp.Ok(cntRe.value)
    return next()
}

async function list(ctx: KCtxT, next: NextT) {
    const { userId, chain } = ctx.request.body
    log.debug('get project list: ', userId, chain)
    let re = await Project.list(userId, chain)
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
    const pro = { id } as ProAttr
    if (reqSecLimit) { pro.reqSecLimit = reqSecLimit }
    if (reqDayLimit) { pro.reqDayLimit = reqDayLimit }
    if (bwDayLimit) { pro.bwDayLimit = bwDayLimit }

    const re = await Project.update(pro)
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

R.post('/list', list)
R.post('/count/chain', countOfChain)
R.post('/count/user', countOfUser)

R.post('/detail/chainpid', findByChainPid)
R.post('/detail/id', findById)
R.post('/detail/status', statusByChainPid)

R.post('/update/name', updateName)
R.post('/update/limit', updateLimit)
R.post('/update/status', updateStatus)

R.post('/create', create)
R.post('/delete', deleteProject)

export default R.routes()