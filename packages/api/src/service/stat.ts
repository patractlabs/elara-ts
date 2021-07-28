import { getAppLogger, IDT, KEYS } from '@elara/lib'
import geo from 'geoip-country'
import { now, formateDate } from '../lib/date'
import KEY from '../lib/KEY'
import Conf from '../../config'
import { statRd } from '../dao/redis'
import { StatT, Stats, Statistics } from '../interface'
import Mom from 'moment'
import { lastTime } from '../util'

const sKEY = KEYS.Stat
const limitConf = Conf.getLimit()
const log = getAppLogger('stat')

type PStatT = Promise<StatT>

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
    craeteTime: string,
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
        let delay = ((end - start) > limitConf.timeout) ? limitConf.timeout : (end - start)

        await Stat._request_response(info)//最新1000个请求记录
        await Stat._timeout(pid, parseInt(delay.toString()))//
        await Stat._today_request(pid)　//今日请求数统计
        await Stat._method(pid, method) //每日调用方法分类统计
        await Stat._bandwidth(pid, bandwidth)//每日带宽统计
        await Stat._code(pid, code)//每日调用响应码分类统计
        await Stat._header(header, pid)//请求头分析统计
        await Stat._chain(chain) //链的总请求数统计

        log.info('pid=', pid, ',protocol=', protocol, ',chain=', chain, ',method=', method, ',code=', code, ',bandwidth=', bandwidth, ',delay=', delay)
    }

    static async _request_response(info: any) {
        // 最新的1000条请求记录
        await statRd.lpush(KEY.REQUEST_RESPONSE(), JSON.stringify(info))
        await statRd.ltrim(KEY.REQUEST_RESPONSE(), 0, limitConf.maxReqKeep)
    }

    static async _timeout(pid: any, delay: number) {
        let date = formateDate(new Date())

        if (delay >= limitConf.timeout) {
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
            log.error('request_response Parse Error!', e)
        }

        return requests
    }

}

//////////////////////////////////////////////////////////
function newStats(): Stats {
    return {
        wsReqNum: 0,
        wsConn: 0,
        wsCt: '{}',
        wsBw: 0,
        wsDelay: 0,
        wsInReqNum: 0,
        wsTimeout: 0,
        wsTimeoutCnt: 0,

        httpReqNum: 0,
        httpCt: '{}',
        httpBw: 0,
        httpDelay: 0,
        httpInReqNum: 0,
        httpTimeout: 0,
        httpTimeoutCnt: 0
    }
}

type MomUnit = 'day' | 'hour' | 'minute' | 'second'

export function startStamp(off: number, unit: MomUnit): number {
    return Mom().subtract(off, `${unit}s`).startOf(unit as Mom.unitOfTime.StartOf).valueOf()
}

function accAverage(num: number, av: number, val: number, fixed: number = 2): string {
    return (av / (num + 1) * num + val / (num + 1)).toFixed(fixed)
}

function ip2county(ip: string): string {
    const dat = geo.lookup(ip)
    if (dat) {
        return dat.country
    }
    return 'unknow'
}

function out(val: string | number): number {
    if (val === undefined) return 0
    const v = parseInt(val as string) ?? 0
    log.debug('out value: ', val, v)
    return v
}

export async function dailyStatDumps(req: Statistics, dat: Stats): Promise<Stats> {
    // const dat = await fetchOld(key)
    const { curNum, curDelay } = dat
    // const dat = newStat()

    const acdely = accAverage(curNum as number ?? 0, curDelay as number ?? 0, req.delay ?? 0)
    if (req.timeout) {
        dat[`${req.proto}TimeoutCnt`] = out(dat[`${req.proto}TimeoutCnt`]) + 1
        dat[`${req.proto}Timeout`] = acdely
    } else {
        dat[`${req.proto}Delay`] = acdely
    }
    let reqCnt = 1
    if (req.proto === 'ws') {
        reqCnt = req.reqCnt ?? 0
    }
    dat[`${req.proto}ReqNum`] = out(dat[`${req.proto}ReqNum`]) + reqCnt
    // ws connection cnt
    if (req.type === 'conn') {
        dat.wsConn = out(dat.wsConn) + 1
        // Rd.hincrby(key, 'wsConn', 1)
    }
    if (req.bw !== undefined) {
        dat[`${req.proto}Bw`] = out(dat[`${req.proto}Bw`]) + req.bw
        // Rd.hincrby(key, `${req.proto}Bw`, req.bw)
    }
    if (req.code !== 200) {
        dat[`${req.proto}InReqNum`] = out(dat[`${req.proto}InReqNum`]) + 1
    }

    // country access
    if (req.header !== undefined && req.header.ip) {
        const c = ip2county(req.header.ip.split(':')[0])
        const ac: Record<string, number> = JSON.parse((dat[`${req.proto}Ct`] as string) ?? '{}')
        log.debug('country parse: ', c, ac)
        ac[c] = (ac[c] ?? 0) + 1
        dat[`${req.proto}Ct`] = JSON.stringify(ac)
    }
    return dat
}

// function statMerge(l: string, r: string): string {
//     const lct = JSON.parse(l)
//     const rct = JSON.parse(r)
//     Object.keys(rct).forEach(k => {
//         if (Object.keys(lct).includes(k)) {
//             lct[k] += rct[k]
//         } else {
//             lct[k] = rct[k]
//         }
//     })
//     return JSON.stringify(lct)
// }

// function statAdd(l: StatT, r: StatT): StatT {
//     l.wsConn += r.wsConn
//     l.wsReqNum += r.wsReqNum
//     l.wsInReqNum += r.wsInReqNum
//     l.wsBw += r.wsBw
//     l.wsDelay += r.wsDelay
//     l.wsTimeout += r.wsTimeout
//     l.wsTimeoutCnt += r.wsTimeoutCnt
//     l.wsCt = statMerge(l.wsCt, r.wsCt)

//     l.httpReqNum += r.httpReqNum
//     l.httpInReqNum += r.httpInReqNum
//     l.httpBw += r.httpBw
//     l.httpDelay += r.httpDelay
//     l.httpTimeout += r.httpTimeout
//     l.httpTimeoutCnt += r.httpTimeoutCnt
//     l.httpCt = statMerge(l.httpCt, r.httpCt)

//     return l
// }

namespace Stat {
    // elara statistic
    export async function total(): PStatT {
        return await statRd.hgetall(sKEY.hTotal()) as unknown as StatT
    }

    export const daily = async (): PStatT => {
        let res = newStats()
        try {
            const re = await statRd.hgetall(sKEY.hDaily())
            if (re === null) {
                log.error('Redis get daily statistic failed')
            }
            res = re
        } catch (e) {
            log.error('Dashboard Parse Error!')
        }
        return res as unknown as StatT
    }

    export const latestReq = async (num: number): Promise<Statistics[]> => {
        log.debug('latest request: ', num)
        const keys = await statRd.zrevrange(sKEY.zStatList(), -num, -1)
        const res: Statistics[] = []
        for (let k of keys) {
            const re = await statRd.get(`Stat_${k}`)
            if (re === null) {
                statRd.zrem(sKEY.zStatList(), k)
                continue
            }
            const stat = JSON.parse(re) as Statistics
            if (stat.header.ip !== 'localhost') {
                stat.header.ip.replace(/^(\d*)\.(\d*)/, '***.***')
            }
            res.push(stat)
        }
        return res
    }

    export async function lastDays(day: number, pid?: string): Promise<StatT[]> {
        log.debug(`last days pid[${pid}]: `, day)
        let stat: StatT[] = [pid !== undefined ? await proDaily(pid) : await daily()]
        // let stat = pid !== undefined ? await proDaily(pid) : await daily()
        if (day < 2) {
            return stat
        }
        // let stat = await daily()
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            const keys = await statRd.keys(sKEY.hProDaily('*', pid ?? '*', stamp))
            for (let k of keys) {
                const tmp = await statRd.hgetall(k)
                stat.push(tmp as unknown as StatT)
                // stat = statAdd(stat, tmp as unknown as StatT)
            }
        }
        return stat
    }

    export async function lastHours(hour: number, pid?: string): Promise<StatT[]> {
        log.debug(`last hours pid[${pid}]: `, hour)

        let res: StatT[] = []
        if (hour < 1) { hour = 1 }
        for (let h = 0; h < hour; h++) {
            let stat = newStats()
            const [start, end] = lastTime('hour', h)
            // const start = startStamp(hour, 'hour')
            const keys = await statRd.zrangebyscore(sKEY.zStatList(), start, end)
            log.debug('hour keys: ', keys, start, end)
            for (let k of keys) {
                if (pid && !k.includes(pid)) { continue }
                const tmp = await statRd.get(`Stat_${k}`)
                if (tmp === null) {
                    statRd.zrem(sKEY.zStatList(), k)
                    continue
                }
                stat = await dailyStatDumps(JSON.parse(tmp) as Statistics, stat)
            }
            res.push(stat as unknown as StatT)
        }
        return res
    }

    // export const mostReq

    // project statistic
    export const proDaily = async (pid: string): PStatT => {
        let stat = newStats()
        const keys = await statRd.keys(`Stat_*_${pid}_*`)
        log.debug('project daily keys: ', keys, pid)
        for (let k of keys) {
            log.debug('update stat: ', stat)
            const s = await statRd.get(k)
            if (s === null) { continue }
            const stmp = JSON.parse(s) as Statistics
            stat = await dailyStatDumps(stmp, stat)
        }
        return stat as unknown as StatT
    }
}

export default Stat