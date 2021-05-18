import Project from '../../service/project'
import Stat from'../../service/stat'
import Limit from '../../service/limit'
import { KCtxT, NextT, getAppLogger, Code, Result, Msg } from 'lib'
import { isErr } from '../../lib/result'

const log = getAppLogger('stat-pro', true)

//验证登录态，新建项目
let createProeject = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user
    let chain = ctx.request.body.chain
    let name = ctx.request.body.name
    log.info('request: ', uid, chain, name)

    if (name === '' || name === null || !/[a-zA-Z]{4,32}/.test(name)) {
        log.error('Project name invalid or empty');
        throw Result.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
    }

    // check valid chain name in config list
    // TODO add config check
    if (![chain?.toLowerCase()]) {
        log.error('Invalid chain!')
        throw Result.Fail(Code.Chain_Err, Msg.Chain_Err)
    }

    let count = await Stat.countByAccount(uid)
    let limit = await Limit.create(uid)
    if (count >= limit.project) {
        log.error('Out of max project create number!')
        throw Result.Fail(Code.Pro_Num_Limit, Msg.Pro_Num_Limit)
    }

    let exist = await Project.isExist(uid, chain, name)
    if (exist) {
        log.error(`An project named [${name}] existed`)
        throw Result.Fail(Code.Dup_Name, Msg.Dup_Name)
    }
    let project = await Project.create(uid, chain, name)

    log.info('create project result: ', project)

    if (isErr(project)) {
        throw Result.Fail(Code.Pro_Err, Msg.Pro_Err)
    }
    ctx.body = Result.Ok(project.value)   // equals to ctx.response.body
    return next()
}


//验证登录态，获取项目详情
const getProject = async (ctx: KCtxT, next: NextT) => {
    log.info('Into project detail')
    let uid = ctx.state.user
    let pid = ctx.request.params.pid
    let chain = ctx.request.params.chain    // TODO
    // check UID or not
    let project = await Project.detail(chain, pid)
    if (isErr(project)) {
        throw Result.Fail(Code.Pro_Err, project.value as Msg)
    }
    ctx.body = Result.Ok(project.value)
    return next()
}

//验证登陆态,获取账户下按链统计的项目计数
let getProjectCount = async (ctx: KCtxT, next: NextT) => {
    let uid = ctx.state.user
    let projects = await Project.projectNumOfAllChain(uid)
    if (isErr(projects)) {
        throw Result.Whocare()
    }
    ctx.body = Result.Ok(projects.value)
    return next()
}

//验证登录态，获取账户下所有项目详情
let getProjects = async (ctx: KCtxT, next: NextT) => {

    let chain = ctx.request.query.chain
    let uid = ctx.state.user
    log.info('Into project list: ', uid, chain)
    let projects = await Project.projectList(uid, chain)
    if (isErr(projects)) {
        throw Result.Whocare()
    }
    ctx.body = Result.Ok(projects.value)
    return next()
}

let switchStatus = async (ctx: KCtxT, next: NextT): Promise<Result> => {
    const bd = ctx.request.body
    const chain = bd.chain
    const pid = bd.pid
    let re = await Project.switchStatus(chain, pid)
    if (isErr(re)) {
        throw Result.Fail(Code.Pro_Err, re.value as Msg)
    }
    ctx.body = Result.Ok(re.value)
    return next()
}

    
module.exports = {
    'GET /project/:chain/:pid([a-z0-9]{32})': getProject,
    'GET /project/:pid([a-z0-9]{32})': getProject,  //项目详情
    'GET /project/list': getProjects,   //账户下所有项目详情 chain参数指定特定链下面的项目列表
    'POST /project/create': createProeject, //新建项目
    'GET /project/count': getProjectCount,   //分链的项目计数
    'POST /project/status/switch': switchStatus,
}