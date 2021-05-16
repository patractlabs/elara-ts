import Project from '../../service/project'
import Stat from'../../service/stat'
import Limit from '../../service/limit'
import { checkAuthenticated, checkProject } from '../../../lib/check'
import { Code, Msg } from '../../../lib/ApiCode'
import Result from '../../../lib/ApiResponse'

//验证登录态，获取项目详情
const getProject = async (ctx: any, next: any) => {
    if (!checkAuthenticated(ctx)) {
        return next()
    }
    let uid = ctx.state.user
    let pid = ctx.request.params.pid
    let project = await checkProject(pid, uid)

    ctx.response.body = JSON.stringify(Result.Ok(project))
    return next()
}

//验证登陆态,获取账户下按链统计的项目计数
let getProjectCount = async (ctx: any, next: any) => {
    if (!checkAuthenticated(ctx)) {
        return next()
    }

    let uid = ctx.state.user
    let projects = await Project.getAllCountByAccount(uid)
    ctx.response.body = JSON.stringify(projects)
    return next()
}

//验证登录态，获取账户下所有项目详情
let getProjects = async (ctx: any, next: any) => {
    if (!checkAuthenticated(ctx)) {
        return next()
    }
    let chain = ctx.request.query.chain
    let uid = ctx.state.user
    let projects = await Project.getAllByAccount(uid, chain)
    ctx.response.body = JSON.stringify(projects)
    return next()
}

//验证登录态，新建项目
let createProeject = async (ctx: any, next: any) => {
    if (!checkAuthenticated(ctx)) {
        return next()
    }
    let uid = ctx.state.user
    let chain = ctx.request.body.chain
    let name = ctx.request.body.name
    if (!name) {
        return Result.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
        // throw CODE.PROJECT_NAME_EMPTY
    }
    if (! /[a-zA-Z]{4,32}/.test(name)) {
        return Result.Fail(Code.Pro_Name_Err, Msg.Pro_Name_Error)
        // throw CODE.PROJECT_NAME_ERROR
    }
    //必须在链列表中
    if (![chain.toLowerCase()]) {
        return Result.Fail(Code.Chain_Err, Msg.Chain_Err)

        // throw CODE.CHAIN_ERROR
    }
    let count = await Stat.countByAccount(uid)
    let limit = await Limit.create(uid)

    if (count >= limit.project) {
        return Result.Fail(Code.Out_Of_Limit, Msg.Out_Of_Limit)

        // throw CODE.OUT_OF_LIMIT
    }

    let exist = await Project.isExist(uid, chain, name)
    if (exist) {
        return Result.Fail(Code.Dup_Name, Msg.Dup_Name)

        // throw CODE.DUPLICATE_NAME
    }
    let project = await Project.create(uid, chain, name)

    ctx.response.body = project.toString()
    return next()
}

module.exports = {
    'GET /project/:pid([a-z0-9]{32})': getProject,//项目详情
    'GET /project/list': getProjects,//账户下所有项目详情 chain参数指定特定链下面的项目列表
    'POST /project/create': createProeject, //新建项目
    'GET /project/count': getProjectCount//分链的项目计数
}