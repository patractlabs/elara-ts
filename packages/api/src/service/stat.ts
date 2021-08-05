import { getAppLogger, Redis, DBT, KEYS, randomId } from '@elara/lib'
import geo from 'geoip-country'
import { StatT, Stats, Statistics } from '../interface'
import Mom from 'moment'
import { lastTime, todayStamp } from '../util'

const sKEY = KEYS.Stat
const log = getAppLogger('stat')
const StatRd = new Redis(DBT.Stat)
StatRd.onConnect(() => {
    log.info(`stat redis connection open`)
})

StatRd.onError((err) => {
    log.error(`stat redis connection error: %o`, err)
})
const Rd = StatRd.getClient()

type PStatT = Promise<StatT>

function newStats(): StatT {
    return {
        wsReqNum: 0,
        wsConn: 0,
        wsSubNum: 0,
        wsSubResNum: 0,
        wsCt: {},
        wsBw: 0,
        wsDelay: 0,
        wsInReqNum: 0,
        wsTimeout: 0,
        wsTimeoutCnt: 0,

        httpReqNum: 0,
        httpCt: {},
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

function accAverage(num: number, av: number, val: number, fixed: number = 2): number {
    return parseFloat((av / (num + 1) * num + val / (num + 1)).toFixed(fixed))
}

function ip2county(ip: string): string {
    const dat = geo.lookup(ip)
    if (dat) {
        return dat.country
    }
    return 'unknow'
}

function asNum(val: number | Record<string, number>): number {
    return (val as number) ?? 0
}

async function dailyStatistic(req: Statistics, dat: Stats): Promise<Stats> {
    const { curNum, curDelay } = dat
    const acdely = accAverage(curNum as number ?? 0, curDelay as number ?? 0, req.delay ?? 0)
    if (req.timeout) {
        dat[`${req.proto}TimeoutCnt`] = asNum(dat[`${req.proto}TimeoutCnt`]) + 1
        dat[`${req.proto}Timeout`] = acdely
    } else {
        dat[`${req.proto}Delay`] = acdely
    }
    if (req.proto === 'ws' && req.reqCnt) {
        dat['wsSubNum'] = asNum(dat['wsSubNum']) + 1
        dat['wsSubResNum'] = asNum(dat['wsSubResNum']) + req.reqCnt
    }
    dat[`${req.proto}ReqNum`] = asNum(dat[`${req.proto}ReqNum`]) + 1
    // ws connection cnt
    if (req.type === 'conn') {
        dat.wsConn = asNum(dat.wsConn) + 1
    }
    if (req.bw !== undefined) {
        dat[`${req.proto}Bw`] = asNum(dat[`${req.proto}Bw`]) + req.bw
    }
    if (req.code !== 200) {
        dat[`${req.proto}InReqNum`] = asNum(dat[`${req.proto}InReqNum`]) + 1
    }

    // country access
    if (req.header !== undefined && req.header.ip) {
        const c = ip2county(req.header.ip.split(':')[0])
        const ac: Record<string, number> = dat[`${req.proto}Ct`] as Record<string, number>
        ac[c] = (ac[c] ?? 0) + 1
        dat[`${req.proto}Ct`] = ac
    }
    return dat
}

async function handleScore(res: Record<string, number>, key: string): Promise<Record<string, number>> {
    const lis = await Rd.zrange(key, 0, -1, 'WITHSCORES')
    const len = lis.length
    for (let i = 0; i < len; i += 2) {
        res[lis[i]] = (res[lis[i]] ?? 0) + parseInt(lis[i + 1])
    }
    return res
}

function statMerge(lct: Record<string, number>, rct: Record<string, number>): Record<string, number> {
    Object.keys(rct).forEach(k => {
        if (Object.keys(lct).includes(k)) {
            lct[k] += rct[k]
        } else {
            lct[k] = rct[k]
        }
    })
    return lct
}

function statAdd(l: StatT, r: StatT): StatT {
    l.wsConn += r.wsConn
    l.wsReqNum += r.wsReqNum
    l.wsSubNum += r.wsSubNum
    l.wsSubResNum += r.wsSubResNum
    l.wsInReqNum += r.wsInReqNum
    l.wsBw += r.wsBw
    l.wsDelay += r.wsDelay
    l.wsTimeout += r.wsTimeout
    l.wsTimeoutCnt += r.wsTimeoutCnt
    l.wsCt = statMerge(l.wsCt ?? {}, r.wsCt ?? {})

    l.httpReqNum += r.httpReqNum
    l.httpInReqNum += r.httpInReqNum
    l.httpBw += r.httpBw
    l.httpDelay += r.httpDelay
    l.httpTimeout += r.httpTimeout
    l.httpTimeoutCnt += r.httpTimeoutCnt
    l.httpCt = statMerge(l.httpCt ?? {}, r.httpCt ?? {})

    return l
}

function parseStatRecord(stat: Record<string, string>): StatT {
    return {
        wsReqNum: parseInt(stat.wsReqNum ?? '0'),
        wsConn: parseInt(stat.wsConn ?? '0'),
        wsSubNum: parseInt(stat.wsSubNum ?? '0'),
        wsSubResNum: parseInt(stat.wsSubResNum ?? '0'),
        wsCt: JSON.parse(stat.wsCt ?? '{}'),
        wsBw: parseInt(stat.wsBw ?? '0'),
        wsDelay: parseFloat(stat.wsDelay ?? '0.0'),
        wsInReqNum: parseInt(stat.wsInReqNum ?? '0'),
        wsTimeout: parseFloat(stat.wsTimeout ?? '0'),
        wsTimeoutCnt: parseInt(stat.wsTimeoutCnt ?? '0'),

        httpReqNum: parseInt(stat.httpReqNum ?? '0'),
        httpCt: JSON.parse(stat.httpCt ?? '{}'),
        httpBw: parseInt(stat.httpBw ?? '0'),
        httpDelay: parseFloat(stat.httpDelay ?? '0'),
        httpInReqNum: parseInt(stat.httpInReqNum ?? '0'),
        httpTimeout: parseFloat(stat.httpTimeout ?? '0'),
        httpTimeoutCnt: parseInt(stat.httpTimeoutCnt ?? '0')
    }
}

class Stat {
    // elara statistic
    static async total(): PStatT {
        return parseStatRecord(await Rd.hgetall(sKEY.hTotal()))
    }

    static async daily(): PStatT {
        let res = newStats() as StatT
        try {
            const re = await Rd.hgetall(sKEY.hDaily())
            if (re === null) {
                log.error('Redis get daily statistic failed')
            }
            res = parseStatRecord(re)
        } catch (e) {
            log.error('Dashboard Parse Error!')
        }
        return res as unknown as StatT
    }

    static async latestReq(num: number): Promise<Statistics[]> {
        if (num < 1) { num = 1 }
        const keys = await Rd.zrevrange(sKEY.zStatList(), 0, num - 1)
        log.debug('latest request: %o %o', num, keys)
        const res: Statistics[] = []
        for (let k of keys) {
            const re = await Rd.get(`Stat_${k}`)
            if (re === null) {
                Rd.zrem(sKEY.zStatList(), k)
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

    static async lastDays(day: number, chain?: string, pid?: string): Promise<StatT[]> {
        log.debug(`last days pid[${pid}]: ${day}`)
        let stat: StatT[] = [pid !== undefined ? await Stat.proDaily(chain!, pid) : await Stat.daily()]
        // let stat = pid !== undefined ? await proDaily(pid) : await daily()
        if (day < 2) {
            return stat
        }
        // let stat = await daily()
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            if (pid !== undefined) {
                const re = await Rd.hgetall(sKEY.hProDaily(chain!, pid, stamp))
                stat.push(parseStatRecord(re))
                continue
            }

            const keys = await Rd.keys(sKEY.hProDaily('*', '*', stamp))
            log.debug('last days keys: %o %o', i, keys)
            let tstat = newStats() as unknown as StatT
            for (let k of keys) {
                const tmp = await Rd.hgetall(k)
                tstat = statAdd(tstat, parseStatRecord(tmp))
            }
            stat.push(tstat)
        }
        return stat
    }

    static async lastHours(hour: number, pid?: string): Promise<StatT[]> {
        let res: StatT[] = []
        if (hour < 1) { hour = 1 }
        for (let h = 0; h < hour; h++) {
            let stat = newStats() as unknown as Stats
            const [start, end] = lastTime('hour', h)
            // const start = startStamp(hour, 'hour')
            const keys = await Rd.zrangebyscore(sKEY.zStatList(), start, end)
            for (let k of keys) {
                if (pid && !k.includes(pid)) { continue }
                const tmp = await Rd.get(`Stat_${k}`)
                if (tmp === null) {
                    Rd.zrem(sKEY.zStatList(), k)
                    continue
                }
                stat = await dailyStatistic(JSON.parse(tmp) as Statistics, stat)
            }
            res.push(stat as unknown as StatT)
        }
        return res
    }

    static async mostResourceLastDays(num: number, day: number, typ: string) {
        let key = sKEY.zDailyReq()
        if (typ === 'bandwidth') {
            key = sKEY.zDailyBw()
        }
        if (num < 1) { num = 1 }
        if (day < 2) {
            return Rd.zrevrange(key, 0, num - 1, 'WITHSCORES')
        }
        let res = await handleScore({}, key)
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            const keys = await Rd.keys(typ === 'req' ? sKEY.zReq('*', '*', stamp) : sKEY.zBw('*', '*', stamp))
            for (let k of keys) {
                res = await handleScore(res, k)
            }
        }
        const skey = `Z_Score_${typ}_${randomId()}`
        for (let m in res) {
            Rd.zadd(skey, res[m], m)
        }
        const re = await Rd.zrevrange(skey, 0, num - 1, 'WITHSCORES')
        Rd.del(skey)
        log.debug(`${typ} score rank reulst: %o`, re)
        return re
    }

    static async recentError(num: number): Promise<Statistics[]> {
        if (num < 1) { num = 1 }
        const keys = await Rd.zrevrange(sKEY.zErrStatList(), 0, num - 1)
        const res: Statistics[] = []
        for (let k of keys) {
            const re = await Rd.get(`Stat_Err_${k}`)
            if (re === null) {
                Rd.zrem(sKEY.zErrStatList(), k)
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

    // chain statistic
    static async chain(chain: string): PStatT {
        return parseStatRecord(await Rd.hgetall(sKEY.hChainTotal(chain)))
    }

    // project statistic
    static async proDaily(chain: string, pid: string): PStatT {
        const re = await Rd.hgetall(sKEY.hProDaily(chain, pid, todayStamp()))
        log.debug(`get ${chain} project[${pid}] day statistic: %o`, re)
        let stat = parseStatRecord(re) as unknown as Stats

        const [start, end] = lastTime('hour', 0)
        const keys = await Rd.zrangebyscore(sKEY.zStatList(), start, end)
        log.debug('project daily last hour keys: %o', keys)
        for (let k of keys) {
            if (!k.includes(pid)) { continue }
            const key = `Stat_${k}`
            const re = await Rd.get(key)
            if (re === null) { continue }
            const stmp = JSON.parse(re) as Statistics
            stat = await dailyStatistic(stmp, stat)
        }
        return stat as unknown as StatT
    }
}

export default Stat