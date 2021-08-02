import Project from '../service/project'
import { ProAttr, ProStatus } from '../models/project'
import { KCtxT, NextT, getAppLogger, Code, Resp, Msg, PVoidT } from '@elara/lib'
import { isErr, isEmpty } from '@elara/lib'
import { lengthOk } from '../lib'
import Router from 'koa-router'
import Conf from '../../config'

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

async function checkProjectLimit(uid: string): PVoidT {
    let cntRe = await Project.countByUser(uid)
    if (isErr(cntRe)) {
        log.error(`fetch uid[${uid}] total created project num error: ${cntRe}`)
        throw Resp.Fail(Code.Pro_Num_Limit, cntRe.value as Msg)
    }

    const conf = Conf.getLimit()
    const cnt = cntRe.value
    if (cnt >= conf.maxProjectNum) {
        log.error('Out of max project create number!')
        throw Resp.Fail(Code.Pro_Num_Limit, Msg.Pro_Num_Limit)
    }
}

//验证登录态，新建项目
async function create(ctx: KCtxT, next: NextT) {
    let uid = ctx.state.user
    log.debug('create project request: ', uid, ctx.request.body)
    const pro = ctx.request.body as ProAttr

    checkName(pro.name)


    await checkProjectLimit(uid)

    const re = await Project.create(uid, pro)

    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, Msg.Pro_Err)
    }

    log.info('create project result: ', re)

    ctx.body = Resp.Ok(re.value)   // equals to ctx.response.body
    return next()
}

async function findById(ctx: KCtxT, next: NextT) {
    const { id } = ctx.request.body
    const re = await Project.findById(id)
    if (isErr(re)) {
        throw Resp.Fail(500, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function findByChainPid(ctx: KCtxT, next: NextT) {
    const { chain, pid } = ctx.request.params
    log.debug('get project detail: ', chain, pid)
    checkChainPid(chain, pid)
    // check UID or not
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
    let re = await Project.countOfChain(chain)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function projectCountByUser(ctx: KCtxT, next: NextT) {
    const uid = ctx.state.user
    let cntRe = await Project.countByUser(uid)
    if (isErr(cntRe)) {
        log.error(`fetch uid[${uid}] total created project num error: ${cntRe}`)
        throw Resp.Fail(Code.Pro_Num_Limit, cntRe.value as Msg)
    }
    ctx.body = Resp.Ok(cntRe.value)
    return next()
}

// project list by chain
async function projectListByChain(ctx: KCtxT, next: NextT) {
    const { chain } = ctx.request.params
    let uid = ctx.state.user
    log.debug('get project list: ', uid, chain)
    let re = await Project.findByChain(chain)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function updateStatus(ctx: KCtxT, next: NextT) {
    const {id, status} = ctx.request.body as ProAttr
    if (status) {checkStatus(status)}
    const re = await Project.update({id, status} as ProAttr)
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
    const { id, name } = ctx.request.body
    checkName(name)
    const re = await Project.update({id, name} as ProAttr)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(name)
    return next()
}

async function deleteProject(ctx: KCtxT, next: NextT) {
    const { id } = ctx.request.body
    const re = await Project.delete(id)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok()
    return next()
}

R.get('/:chain/list', projectListByChain)
R.post('/count/chain', countOfChain)
R.get('/count', projectCountByUser)
R.get('/:chain/:pid([a-z0-9]{32})', findByChainPid)

R.post('/detail/id', findById)
R.post('/name', updateName)
R.post('/limit', updateLimit)
R.post('/status', updateStatus)
R.post('/create', create)
R.post('/delete', deleteProject)

export default R.routes()