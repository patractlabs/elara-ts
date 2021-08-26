import { getAppLogger, Redis, DBT, KEYS } from '@elara/lib'
import { StatT } from '../interface'
import Mom from 'moment'
import { todayStamp } from '../util'
import Conf from '../../config'
const sKEY = KEYS.Stat
const rconf = Conf.getRedis()

const log = getAppLogger('stat')
const StatRd = new Redis(DBT.Stat, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})
StatRd.onConnect(() => {
    log.info(`stat redis connection open`)
})

StatRd.onError((err) => {
    log.error(`stat redis connection error: %o`, err)
})

const Rd = StatRd.getClient()
type PStatT = Promise<StatT>

export function newStats(): StatT {
    return {
        reqCnt: 0,
        wsConn: 0,
        bw: 0,
        delay: 0,
        inReqCnt: 0,
        timeoutDelay: 0,
        timeoutCnt: 0,
        subCnt: 0,
        subResCnt: 0,
        ctMap: '{}',
    }
}

type MomUnit = 'day' | 'hour' | 'minute' | 'second'

function startStamp(off: number, unit: MomUnit): number {
    const date = Mom().subtract(off, `${unit}s`).startOf(unit as Mom.unitOfTime.StartOf)
    log.debug(`start time stamp of ${unit}: ${date} ${date.valueOf()}`)
    return date.valueOf()
}

function accAverage(num: number, av: number, val: number, fixed: number = 2): number {
    return parseFloat((av / (num + 1) * num + val / (num + 1)).toFixed(fixed))
}

function statMerge(lct: Record<string, number>, rct: Record<string, number>): string {
    Object.keys(rct).forEach(k => {
        if (Object.keys(lct).includes(k)) {
            lct[k] += rct[k]
        } else {
            lct[k] = rct[k]
        }
    })
    return JSON.stringify(lct)
}

export function statAdd(l: StatT, r: StatT): StatT {
    l.wsConn += r.wsConn
    l.reqCnt += r.reqCnt
    l.subCnt += r.subCnt
    l.subResCnt += r.subResCnt
    l.inReqCnt += r.inReqCnt
    l.delay = accAverage(l.reqCnt, l.delay, r.delay)
    l.bw += r.bw
    l.timeoutCnt += r.timeoutCnt
    l.timeoutDelay = accAverage(l.timeoutCnt, l.timeoutDelay, r.timeoutDelay)
    l.ctMap = statMerge(JSON.parse(l.ctMap ?? '{}'), JSON.parse(r.ctMap ?? '{}'))
    return l
}

export function parseStatInfo(stat: Record<string, string>): StatT {
    return {
        reqCnt: parseInt(stat.reqCnt ?? '0'),
        bw: parseInt(stat.bw ?? '0'),
        wsConn: parseInt(stat.wsConn ?? '0'),
        subCnt: parseInt(stat.subCnt ?? '0'),
        subResCnt: parseInt(stat.subResCnt ?? '0'),
        delay: parseFloat(stat.delay ?? '0'),
        timeoutCnt: parseInt(stat.timeoutCnt ?? '0'),
        timeoutDelay: parseFloat(stat.timeoutDelay ?? '0'),
        inReqCnt: parseInt(stat.inReqCnt ?? '0'),
        ctMap: stat.ctMap ?? '{}',
    }
}

interface StatInfoT {
    request: number,
    bandwidth: number
}

type PStatInfoT = Promise<StatInfoT>

type StatLineT = {
    timeline: string[],
    stats: StatInfoT[]
}

type PStatLineT = Promise<StatLineT>

type RankMethodT = {
    method: string,
    value: number
}

type RankT = {
    total: number,
    list: RankMethodT[]
}

interface ErrStatT {
    proto: string,
    method: string,
    code: number,
    delay: number,
    time: string
}

interface ErrPageT {
    total: number,
    size: number,
    page: number,
    pages: number,
    list: ErrStatT[]
}

interface CountryT {
    country: string,
    request: number,
    percentage: string
}

function toMb(bytes: number): number {
    return bytes
    // return parseFloat((bytes/1000000.0).toFixed(2))
}

function getStatInfo(stat: StatT, hasChanged: boolean = false): StatInfoT {
    log.debug(`getStatInfo %o `, stat)
    return {
        request: stat.reqCnt,
        bandwidth: hasChanged ? stat.bw : toMb(stat.bw)
    }
}

async function methodStatic(lis: string[], isBandwidth: boolean = false): Promise<RankT> {
    let total = 0
    let list = []
    for (let i = 0; i < lis.length; i += 2) {

        let val = parseInt(lis[i + 1])
        if (isBandwidth) {
            val = toMb(val)
        }
        
        total += val
        list.push({ method: lis[i], value: val })
    }
    return { total, list }
}

class Stat {
    // elara statistic
    static async total(): PStatInfoT {
        const stat = parseStatInfo(await Rd.hgetall(sKEY.hTotal()))
        return {
            request: stat.reqCnt,
            bandwidth: stat.bw
        }
    }

    static async daily(): PStatT {
        let res = newStats()
        try {
            const re = await Rd.hgetall(sKEY.hDaily(todayStamp()))
            if (re === null) {
                log.error('Redis get daily statistic failed')
            }
            res = parseStatInfo(re)
        } catch (e) {
            log.error('Dashboard Parse Error!')
        }
        return res
    }

    static async lastDays(day: number): PStatLineT {
        const today = Mom().utc(true).format('YYYY-MM-DD')
        let stat: StatT = await Stat.daily()
        const timeline: string[] = [today]
        const stats: StatInfoT[] = [getStatInfo(stat)]
        if (day < 2) {
            return { timeline, stats }
        }
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            timeline.push(Mom(stamp).utc(true).format('YYYY-MM-DD'))
            stat = parseStatInfo(await Rd.hgetall(sKEY.hDaily(stamp)))
            stats.push(getStatInfo(stat, true))
        }
        return { timeline, stats }
    }

    // project relate
    static async lastDaysOfProject(day: number, chain: string, pid: string): PStatLineT {
        log.debug(`last days ${chain} pid[${pid}]: ${day}`)
        const today = Mom().utc(true).format('YYYY-MM-DD')
        let stat: StatT = await Stat.proStatDaily(chain, pid)
        const timeline: string[] = [today]
        const stats: StatInfoT[] = [getStatInfo(stat)]
        if (day < 2) {
            return { timeline, stats }
        }
        for (let i = 1; i < day; i++) {
            const stamp = startStamp(i, 'day')
            timeline.push(Mom(stamp).utc(true).format('YYYY-MM-DD'))
            stat = parseStatInfo(await Rd.hgetall(sKEY.hProDaily(chain, pid, stamp)))
            stats.push(getStatInfo(stat, true))
        }
        return { timeline, stats }
    }

    static async lastHoursOfProject(hour: number, chain: string, pid: string): PStatLineT {
        const timeline: string[] = []
        const stats: StatInfoT[] = []
        for (let h = 0; h < hour; h++) {
            const stamp = startStamp(h, 'hour')
            const key = sKEY.hProHourly(chain, pid, stamp)
            const stat = parseStatInfo(await Rd.hgetall(key))
            timeline.push(Mom(stamp).utc(true).format('MM-DD HH:mm'))
            stats.push(getStatInfo(stat, true))
        }
        return { timeline, stats }
    }

    static async proStatDaily(chain: string, pid: string): PStatT {
        const re = await Rd.hgetall(sKEY.hProDaily(chain, pid, todayStamp()))
        log.debug(`get ${chain} project[${pid}] day statistic: %o`, re)
        let stat = parseStatInfo(re)
        return stat
    }

    // latest 10 request methods by rank
    static async latestMethods(chain: string, pid: string): Promise<Record<string, RankT>> {
        // last 30 days record
        const bw = await Rd.zrevrange(sKEY.zProBw(chain, pid), 0, 10 - 1, 'WITHSCORES')
        const req = await Rd.zrevrange(sKEY.zProReq(chain, pid), 0, 10 - 1, 'WITHSCORES')
        log.debug('rank list: %o \n %o', bw, req)
        return {
            bandwidth: await methodStatic(bw, true),
            request: await methodStatic(req)
        }
    }

    // latest error request
    static async recentError(chain: string, pid: string, size: number, page: number): Promise<ErrPageT> {
        const key = sKEY.zErrStatList(chain, pid)
        const total = await Rd.zcard(key)
        const pages = Math.floor(total / size) + 1

        const off = page * size
        const keys = await Rd.zrevrange(key, off, off + size - 1)
        const list: ErrStatT[] = []
        for (let k of keys) {
            const re = await Rd.get(`Stat_Err_${k}`)
            if (re === null) {
                Rd.zrem(sKEY.zErrStatList(chain, pid), k)
                continue
            }
            const stat = JSON.parse(re) as ErrStatT

            list.push(stat)
        }
        return {
            total,
            size,
            page,
            pages,
            list
        }
    }

    // country request map
    static async countryMap(chain: string, pid: string, size: number, page: number) {
        const key = sKEY.zProDailyCtmap(chain, pid)
        const total = await Rd.zcard(key)
        const totalRequest = parseInt(await Rd.zscore(key, 'total'))
        const pages = Math.floor(total / size) + 1

        const off = page * size
        const ct = await Rd.zrevrange(key, off, off + size - 1, 'WITHSCORES')
        log.debug(`get country map: %o`, ct)
        const list: CountryT[] = []
        for (let i = 0; i < ct.length; i += 2) {
            let reqCnt = parseInt(ct[i+1])
            list.push({country: ct[i], request: reqCnt, percentage: (100.00 * reqCnt / totalRequest).toFixed(2) + '%'})
        }
        return {
            total,
            size,
            page,
            pages,
            list
        }
    }

    // chain statistic
    static async chain(chain: string): PStatT {
        return parseStatInfo(await Rd.hgetall(sKEY.hChainTotal(chain)))
    }
}

export default Stat