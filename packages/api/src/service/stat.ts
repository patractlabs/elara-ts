import { getAppLogger, KEYS, randomId } from '@elara/lib'
import geo from 'geoip-country'
import { statRd } from '../dao/redis'
import { StatT, Stats, Statistics } from '../interface'
import Mom from 'moment'
import { lastTime } from '../util'

const sKEY = KEYS.Stat
const log = getAppLogger('stat')

type PStatT = Promise<StatT>

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

function startStamp(off: number, unit: MomUnit): number {
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

async function dailyStatistic(req: Statistics, dat: Stats): Promise<Stats> {
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

async function handleScore(res: Record<string, number>, key: string): Promise<Record<string, number>> {
    const lis = await statRd.zrange(key, 0, -1, 'WITHSCORES')
    const len = lis.length
    for (let i = 0; i < len; i += 2) {
        res[lis[i]] = (res[lis[i]] ?? 0) + parseInt(lis[i + 1])
    }
    return res
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
                stat = await dailyStatistic(JSON.parse(tmp) as Statistics, stat)
            }
            res.push(stat as unknown as StatT)
        }
        return res
    }

    export const mostReqLastDays = async (num: number, day: number): Promise<string[]> => {
        log.debug('most request: ', num, day)
        if (day < 2) {
            return statRd.zrevrange(sKEY.zDailyReq(), 0, num - 1, 'WITHSCORES')
        }
        let res = await handleScore({}, sKEY.zDailyReq())
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            const keys = await statRd.keys(sKEY.zReq('*', '*', stamp))
            for (let k of keys) {
                res = await handleScore(res, k)
            }
        }
        const skey = `Z_Score_req_${randomId()}`
        for (let m in res) {
            statRd.zadd(skey, res[m], m)
        }
        const re = await statRd.zrevrange(skey, 0, num - 1, 'WITHSCORES')
        statRd.del(skey)
        log.debug('score rank reulst: ', re)
        return re
    }

    export const mostResourceLastDays = async (num: number, day: number, typ: string) => {
        log.debug(`most ${typ} request: `, num, day)
        let key = sKEY.zDailyReq()
        if (typ === 'bandwidth') {
            key = sKEY.zDailyBw()
        }
        if (num < 1) { num = 1 }
        if (day < 2) {
            return statRd.zrevrange(key, 0, num - 1, 'WITHSCORES')
        }
        let res = await handleScore({}, key)
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            const keys = await statRd.keys(typ === 'req' ? sKEY.zReq('*', '*', stamp) : sKEY.zBw('*', '*', stamp))
            for (let k of keys) {
                res = await handleScore(res, k)
            }
        }
        const skey = `Z_Score_${typ}_${randomId()}`
        for (let m in res) {
            statRd.zadd(skey, res[m], m)
        }
        const re = await statRd.zrevrange(skey, 0, num - 1, 'WITHSCORES')
        statRd.del(skey)
        log.debug(`${typ} score rank reulst: `, re)
        return re
    }

    // chain statistic
    export const chain = async (chain: string): PStatT => {
        return await statRd.hgetall(sKEY.hChainTotal(chain)) as unknown as StatT
    }

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
            stat = await dailyStatistic(stmp, stat)
        }
        return stat as unknown as StatT
    }
}

export default Stat