import Project, { ProStatus } from '../service/project'
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
async function createProeject(ctx: KCtxT, next: NextT) {
    let uid = ctx.state.user
    log.debug('create project request: ', uid, ctx.request.body)
    const { chain, name, team } = JSON.parse(ctx.request.body)

    checkName(name)
    const exist = await Project.isExist(uid, chain, name)
    if (exist) {
        log.error(`project named [${name}] existed`)
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }

    await checkProjectLimit(uid)

    let re = await Project.create(uid, chain, name, team)

    log.info('create project result: ', re)

    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)   // equals to ctx.response.body
    return next()
}

//验证登录态，获取项目详情
async function projectDetail(ctx: KCtxT, next: NextT) {
    // let uid = ctx.state.user
    const { chain, pid } = ctx.request.params
    log.debug('get project detail: ', chain, pid)
    checkChainPid(chain, pid)
    // check UID or not
    let project = await Project.detail(chain, pid)
    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Resp.Ok(project.value)
    return next()
}

// project count list of chain by user
async function projectCountChainList(ctx: KCtxT, next: NextT) {
    let uid = ctx.state.user
    let re = await Project.countOfChainList(uid)
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
    let re = await Project.listByChain(uid, chain)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(re.value)
    return next()
}

async function updateStatus(ctx: KCtxT, next: NextT) {
    const { chain, pid, status } = JSON.parse(ctx.request.body)
    log.debug(`update ${chain} pid[${pid}] status: `, status)
    checkChainPid(chain, pid)
    checkStatus(status)
    const re = await Project.updateStatus(chain, pid, status)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(status)
    return next()
}

async function updateLimit(ctx: KCtxT, next: NextT) {
    const { chain, pid, reqSecLimit, bwDayLimit } = JSON.parse(ctx.request.body)
    checkChainPid(chain, pid)

    const re = await Project.updateLimit(chain, pid, reqSecLimit, bwDayLimit)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok()
    return next()
}

async function updateName(ctx: KCtxT, next: NextT) {
    const uid = ctx.state.user
    const { chain, pid, name } = JSON.parse(ctx.request.body)
    checkChainPid(chain, pid)
    checkName(name)
    const re = await Project.changeName(chain, uid, pid, name)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Update_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok(name)
    return next()
}

async function deleteProject(ctx: KCtxT, next: NextT) {
    const uid = ctx.state.user
    const { chain, pid } = JSON.parse(ctx.request.body)
    log.debug(`delet project: ${chain} ${pid}`)
    checkChainPid(chain, pid)
    const re = await Project.delete(chain, uid, pid)
    if (isErr(re)) {
        throw Resp.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Resp.Ok()
    return next()
}

R.get('/:chain/list', projectListByChain)
R.get('/count/list', projectCountChainList)
R.get('/count', projectCountByUser)
R.get('/:chain/:pid([a-z0-9]{32})', projectDetail)

R.post('/name', updateName)
R.post('/limit', updateLimit)
R.post('/status', updateStatus)
R.post('/create', createProeject)
R.post('/delete', deleteProject)

export default R.routes()