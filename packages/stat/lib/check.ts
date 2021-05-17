import Project from '../src/service/project'
import {Code, Msg} from './ApiCode'
import Result from './ApiResponse'

export const checkAuthenticated = (ctx: any): Result => {
    console.log('NO_AUTHenv: ', process.env.NO_AUTH)
    if (process.env.NO_AUTH?.toLowerCase() === 'true') {
        ctx.state.user = 'Test_Auth_User'
        return Result.Ok()
    }
    if (!ctx.isAuthenticated()) {
        return Result.Fail(Code.Auth_Fail, Msg.Auth_Fail)
    }
    return Result.Ok()
}

/**
 * 检查是否有权限查看项目
 * @param {*} ctx 
 * @param {*} pid 
 * @param {*} uid 
 */
export const checkProject = async (pid: any, uid: any) => {
    let project = await Project.info(pid)
    if (!project.isOk()) {
        return Result.Fail(Code.Pro_Err, Msg.Pro_Err)
        // throw CODE.PROJECT_ERROR
    }
    project = project.data
    if (uid != project.data.uid) {
        return Result.Fail(Code.Access_Deny, Msg.Access_Deny)
        // throw CODE.NO_ACCESS_ALLOWED
    }

    return project
}