import { getAppLogger, IDT } from '@elara/lib'
import { now, formateDate } from '../lib/date'
import KEY from '../lib/KEY'
import { setConfig } from '../../config'
import { statRd } from '../db/redis'
const config = setConfig()
const logger = getAppLogger('stat')

const safeParseInt = (val: string | null): number => {
    if (val !== null) {
        return parseInt(val)
    }
    return 0
}

export interface StatProtocol {
    protocol: string,    // websocket, http/https
    header: any,        // ctx.request.header same as http.Incomingmessage.headers
    ip: string,
    chain: string,      // lowercase
    pid: IDT,
    method: string,      //  rpc-method { method: 'system_peers' }
    req: string,        // rpc req body
    resp: any,          // reseved
    bandwidth: string | number,     // response package size
    respTime: number | string,      // rpc request response time, ws default 0
    ext?: any                        // extention    reserved
}

/**
 *  统计
 */
class Stat {

    
    static async request(info: any) {

        let protocol = info.protocol
        let header = info.header/*请求头 */
        let chain = info.chain
        let pid = info.pid
        let method = info.method
        // let req = info.req/*请求体 */
        // let resp = info.resp/*响应体 */
        let code = info.code
        let bandwidth = info.bandwidth/*响应带宽*/
        let start = parseInt(info.start)
        let end = parseInt(info.end)
        let delay = ((end - start) > config.timeout) ? config.timeout : (end - start)

        await Stat._request_response(info)//最新1000个请求记录
        await Stat._timeout(pid, parseInt(delay.toString()))//
        await Stat._today_request(pid)　//今日请求数统计
        await Stat._method(pid, method) //每日调用方法分类统计
        await Stat._bandwidth(pid, bandwidth)//每日带宽统计
        await Stat._code(pid, code)//每日调用响应码分类统计
        await Stat._header(header, pid)//请求头分析统计
        await Stat._chain(chain) //链的总请求数统计

        logger.info('pid=', pid, ',protocol=', protocol, ',chain=', chain, ',method=', method, ',code=', code, ',bandwidth=', bandwidth, ',delay=', delay)
    }

    static async _request_response(info: any) {
        // 最新的1000条请求记录
        await statRd.lpush(KEY.REQUEST_RESPONSE(), JSON.stringify(info))
        await statRd.ltrim(KEY.REQUEST_RESPONSE(), 0, config.maxReqKeepNum)
    }
    
    static async _timeout(pid: any, delay: number) {
        let date = formateDate(new Date())

        if (delay >= config.timeout) {
            await statRd.incr(KEY.TIMEOUT(pid, date))
        }

        let average: number | string = safeParseInt(await statRd.get(KEY.DELAY(pid, date)))
        if (average) {//算平均

            let requests = safeParseInt(await statRd.get(KEY.REQUEST(pid, date)))
            average = ((requests * average + delay) / (requests + 1)).toFixed(2)
            await statRd.set(KEY.DELAY(pid, date), average)
        }
        else {
            await statRd.set(KEY.DELAY(pid, date), delay)
        }
    }

    static async _today_request(pid: string) {
        let timestamp = now()
        let date = formateDate(new Date())

        await statRd.incr(KEY.REQUEST(pid, date))
        await statRd.set(KEY.REQUEST_UPDATETIME(pid, date), timestamp)
    }
    static async _method(pid: string, method: string) {
        let date = formateDate(new Date())
        let key_method = KEY.METHOD(pid, date)
        await statRd.hincrby(key_method, method, 1);
    }
    static async _chain(chain: string) {
        await statRd.incr(KEY.TOTAL(chain))
    }
    static async _bandwidth(pid: string, bandwidth: string) {
        let date = formateDate(new Date())
        await statRd.incrby(KEY.BANDWIDTH(pid, date), parseInt(bandwidth))
    }
    static async _code(pid: string, code: string) {
        let date = formateDate(new Date())
        let key_code = KEY.CODE(pid, date)
        await statRd.hincrby(key_code, code, 1);
    }
    static async _header(header: any, pid: string) {
        let agent = header['user-agent'] ? header['user-agent'] : 'null'
        let origin = header['origin'] ? header['origin'] : 'null'
        // let ip = (header['x-forwarded-for'] ? header['x-forwarded-for'].split(/\s*,\s/[0]) : null)  || ''

        Stat._agent(pid, agent)
        Stat._origin(pid, origin)
    }
    static async _agent(pid: string, agent: string) {
        let date = formateDate(new Date())
        let key_agent = KEY.AGENT(pid, date)
        await statRd.hincrby(key_agent, agent, 1)
    }
    static async _origin(pid: string, origin: string) {
        let date = formateDate(new Date())
        let key_origin = KEY.ORIGIN(pid, date)
        await statRd.hincrby(key_origin, origin, 1)
    }

    //链的总请求数
    static async getChain() {
        let total: any = {}
        // TODO chain config
        let chains = ['polkadot', 'westend']

        for (let chain in chains) {
            let count = await statRd.get(KEY.TOTAL(chain))
            total[chain] = count ? count : "0"
        }
        return total
    }

    //项目的某日统计信息
    static async day(pid: string, date: string) {
        if (!date) {
            date = formateDate(new Date())
        }
        let today: any = {}

        let pid_request = await statRd.get(KEY.REQUEST(pid, date))
        today.request = pid_request ? pid_request : '0'

        let request_updatetime = await statRd.get(KEY.REQUEST_UPDATETIME(pid, date))
        today.updatetime = request_updatetime ? request_updatetime : '0'

        let method = await statRd.hgetall(KEY.METHOD(pid, date))
        today.method = method ? method : {}

        let bandwidth = await statRd.get(KEY.BANDWIDTH(pid, date))
        today.bandwidth = bandwidth ? bandwidth : '0'

        let code = await statRd.hgetall(KEY.CODE(pid, date))
        today.code = code ? code : {}

        let agent = await statRd.hgetall(KEY.AGENT(pid, date))
        today.agent = agent ? agent : {}

        let origin = await statRd.hgetall(KEY.ORIGIN(pid, date))
        today.origin = origin ? origin : {}

        let timeout = await statRd.get(KEY.TIMEOUT(pid, date))
        today.timeout = timeout ? timeout : 0

        let delay = await statRd.get(KEY.DELAY(pid, date))
        today.delay = delay ? delay : '0'

        return today
    }
    //项目的周统计信息
    static async days(pid: string, days: number) {
        let oneday = 24 * 60 * 60 * 1000
        let today = (new Date()).getTime()

        let data: any = {}
        for (var i = 0; i < parseInt(days.toString()); i++) {
            let date: string = formateDate(new Date(today - i * oneday))
            data[date] = await Stat.day(pid, date)
        }

        return data
    }
    static async requests(size: number) {
        let requests: any = []

        try {
            let list = await statRd.lrange(KEY.REQUEST_RESPONSE(), 0, size)
            for (var i = 0; i < list.length; i++) {
                requests[i] = JSON.parse(list[i])
                requests[i].pid = requests[i].pid.replace(/(.){16}$/, '******')
                if (requests[i].ip && Array.isArray(requests[i].ip) && requests[i].ip.length) {
                    for (var j = 0; j < requests[i].ip.length; j++) {
                        requests[i].ip[j] = requests[i].ip[j].replace(/^(\d*)\.(\d*)/, '***.***')
                    }
                }
                else if (requests[i].ip) {
                    requests[i].ip = requests[i].ip.replace(/^(\d*)\.(\d*)/, '***.***')
                }
            }
        } catch (e) {
            logger.error('request_response Parse Error!', e)
        }

        return requests
    }

}

namespace Stat {
    export const dashboard = async () => {
        let dashboard = {}
        try {
            let dashVal = await statRd.get(KEY.DASHBOARD())
            if (dashVal === null) {
                logger.error('Redis get dashboard failed')
            } else {
                dashboard = JSON.parse(dashVal)
            }
        } catch (e) {
            logger.error('Dashboard Parse Error!')
        }
        return dashboard
    }
}

export default Stat