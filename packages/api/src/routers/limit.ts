import Project from '../service/project'
import Limit from '../service/limit'
import { Resp, Code, Msg, NextT, KCtxT, getAppLogger, isOk } from '@elara/lib'
import Router from 'koa-router'

const log = getAppLogger('limit')
const R = new Router()

let checkLimit = async (ctx: KCtxT, next: NextT) => {
    let chain = ctx.request.params.chain
    let pid = ctx.request.params.pid
    log.debug(`new limit check request: ${chain} ${pid}`)
    if ('00000000000000000000000000000000' == pid) {//不需要check
        ctx.response.body = JSON.stringify(Resp.Ok())
        return next()
    }

    //检测项目id是否存在
    let re = await Project.detail(chain, pid)
    if (isOk(re)) {
        const project = re.value
        //检测链是否匹配
        if (chain.toLowerCase() != project.chain.toLowerCase()) {
            throw Resp.Fail(Code.Chain_Err, Msg.Chain_Err) // CODE.CHAIN_ERROR
        }
        //检测是否运行中
        if (!Project.isActive(project)) {
            throw Resp.Fail(Code.Pro_Stat_Err, Msg.Pro_Stat_Err) // CODE.PROJECT_NOT_ACTIVE
        }
        let isBlack = await Limit.isBlack(project.uid)
        if (isBlack) {
            throw Resp.Fail(Code.Black_UID, Msg.Black_UID) // CODE.BLACK_UID
        }
        let isLimit = await Limit.isLimit(project.uid, pid)
        //检测是否限流
        if (isLimit) {
            throw Resp.Fail(Code.Out_Of_Limit, Msg.Out_Of_Limit) // CODE.OUT_OF_LIMIT
        }

    } else
        throw Resp.Fail(Code.Pro_Err, Msg.Pro_Err) // CODE.PROJECT_ERROR

    ctx.response.body = Resp.Ok()

    return next()
}
R.get('/:chain/:pid([a-z0-9]{32})', checkLimit)

export default R.routes()

