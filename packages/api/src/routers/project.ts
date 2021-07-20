import Project, { ProStatus } from '../service/project'
import Limit from '../service/limit'
import { KCtxT, NextT, getAppLogger, Code, Resp, Msg } from '@elara/lib'
import { isErr } from '@elara/lib'
import { lengthOk } from '../lib'
import Router from 'koa-router'

const R = new Router()

const log = getAppLogger('stat-pro', true)

//验证登录态，新建项目
let createProeject = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user
    log.debug('create project request: ', uid, ctx.request.body)
    const {chain, name, reqSecLimit, bwDayLimit} = JSON.parse(ctx.request.body)
    
    reqSecLimit
    bwDayLimit
    if (!lengthOk(name, 4, 32) || !/[a-zA-Z0-9]{4,32}/.test(name)) {
        log.error('Project name invalid or empty, name ', name);
        throw Resp.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
    }

    // check valid chain name in config list
    // TODO add config check
    if (!chain?.toLowerCase()) {
        log.error('Invalid chain!')
        throw Resp.Fail(Code.Chain_Err, Msg.Chain_Err)
    }

    let count = await Project.projectNumOfAllChain(uid)
    if (isErr(count)) {
        throw Resp.Fail(Code.Pro_Num_Limit, count.value as Msg)
    }
    
    let limit = await Limit.create(uid)
    if (count.value >= limit.project) {
        log.error('Out of max project create number!')
        throw Resp.Fail(Code.Pro_Num_Limit, Msg.Pro_Num_Limit)
    }

    let exist = await Project.isExist(uid, chain, name)
    if (exist) {
        log.error(`An project named [${name}] existed`)
        throw Resp.Fail(Code.Dup_Name, Msg.Dup_Name)
    }
    let project = await Project.create(uid, chain, name)

    log.info('create project result: ', project)

    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, Msg.Pro_Err)
    }
    ctx.body = Resp.Ok(project.value)   // equals to ctx.response.body
    return next()
}

R.post('/create', createProeject)


//验证登录态，获取项目详情
const getProject = async (ctx: KCtxT, next: NextT) => {
    // let uid = ctx.state.user
    const { chain, pid } = ctx.request.params
    log.info('Into project detail: ', chain, pid)
    // check UID or not
    let project = await Project.detail(chain, pid)
    if (isErr(project)) {
        throw Resp.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Resp.Ok(project.value)
    return next()
}

R.get('/:chain/:pid([a-z0-9]{32})', getProject)


//验证登陆态,获取账户下按链统计的项目计数
let getProjectCount = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user
    let projects = await Project.projectNumOfAllChain(uid)
    if (isErr(projects)) {
        throw Resp.Whocare()
    }
    ctx.body = Resp.Ok(projects.value)
    return next()
}

R.get('/count', getProjectCount)

//验证登录态，获取账户下所有项目详情
R.get('/list', async (ctx: KCtxT, next: NextT) => {

    const { chain } = ctx.request.query
    let uid = ctx.state.user
    log.info('Into project list: ', uid, chain)
    let projects = await Project.projectList(uid, chain)
    if (isErr(projects)) {
        throw Resp.Whocare()
    }
    ctx.body = Resp.Ok(projects.value)
    return next()
})

// 转换项目状态
R.post('/status/update', async (ctx: KCtxT, next: NextT) => {
    const {chain, pid, status} = JSON.parse(ctx.request.body)
    log.debug('update status: ', ctx.request.body, status, Object.values(ProStatus))
    if (!Object.values(ProStatus).includes(status)) {
        log.error(`invalid status`)
    }
    await Project.updateStatus(chain, pid, status)

    ctx.body = Resp.Ok(status)
    return next()
})

R.post('/limit/update', async (ctx: KCtxT, next: NextT) => {
    const { chain, pid, reqSecLimit, bwDayLimit } = JSON.parse(ctx.request.body)
    if (!chain || !pid) {
        log.error(`chain and project id cannot be null`)
        throw Resp.Fail(Code.Pro_Name_Err, 'chain and project id cannot be null' as Msg)
    }
    
    Project.updateLimit(chain, pid, reqSecLimit, bwDayLimit)
    ctx.body = Resp.Ok()
    return next()
})

R.post('/name/change', async (ctx: KCtxT, next: NextT) => {
    const { chain, pid, name } = JSON.parse(ctx.request.body)
    Project.changeName(chain, pid, name)
    ctx.body = Resp.Ok(name)
    return next()
})

export default R.routes()