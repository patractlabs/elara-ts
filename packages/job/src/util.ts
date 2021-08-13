import Mom from 'moment'
import Geoip from 'geoip-lite'
import { getAppLogger, PVoidT } from '@elara/lib'
import { StartT, DurationT, MomUnit, StatT, Statistics, StatRedisT } from './interface'
import { SttRd } from './redis'

const log = getAppLogger('util')

export function lastTime(unit: MomUnit, off: number = 1): number[] {
    const last = Mom().subtract(off, `${unit}s` as DurationT)
    const start = last.startOf(unit as StartT).clone()
    const end = last.endOf(unit as StartT)
    log.debug(`last start-end of ${off} ${unit}: %o %o`, start, end)
    return [start.valueOf(), end.valueOf()]
}

export function tillTime(unit: MomUnit, off: number = 1): number[] {
    const cur = Mom()
    const last = cur.clone().subtract(off, `${unit}s` as DurationT)
    const start = last.startOf(unit as StartT).clone()
    const end = cur.startOf(unit as StartT)
    log.debug(`last start-end of ${off} ${unit}s: %o %o`, start, end)
    return [start.valueOf(), end.valueOf()]
}

export function startStamp(off: number = 1, unit: MomUnit): number {
    const time = Mom().subtract(off, `${unit}s`).startOf(unit as StartT)
    return time.valueOf()
}

export function todayStamp(): number {
    const today = Mom().startOf('day')
    log.debug('today is: %o', today)
    return today.valueOf()
}

export function currentHourStamp(): number {
    const curHour = Mom().startOf('hour')
    log.debug('current hour is: %o', curHour)
    return curHour.valueOf()
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


function accAverage(num: number, av: number, val: number, fixed: number = 2): number {
    return parseFloat((av / (num + 1) * num + val / (num + 1)).toFixed(fixed))
}

export function ip2county(ip: string): string {
    // TODO
    // return ip
    if (ip === 'localhost' || '127.0.0.1') { return 'local' }
    const dat = Geoip.lookup(ip)
    if (dat) {
        return dat.country ?? 'unknow'
    }
    return 'unknow'
}

export function asNum(val: number | string): number {
    return (val as number) ?? 0
}

export async function statisticDump(stat: Statistics, key: string, dat: StatRedisT): PVoidT {
    const curCnt = (dat.reqCnt ?? 0) - (dat.wsConn ?? 0)
    let curDelay = stat.timeout ? dat.timeoutDelay : dat.delay
    const delay = accAverage(curCnt, curDelay ?? 0, stat.delay ?? 0)
    if (stat.timeout) {
        curDelay = dat.timeoutDelay ?? 0
        dat.timeoutCnt += 1
        dat.timeoutDelay = delay
    } else {
        dat.delay = delay
    }

    dat.reqCnt += 1
    if (stat.code !== 200) {
        dat.inReqCnt += 1
    }

    dat.bw += (stat.bw ?? 0)
    if (stat.type === 'conn') { dat.wsConn += 1 }
    if (stat.proto === 'ws' && stat.reqCnt) {
        dat.subCnt += 1
        dat.subResCnt += stat.reqCnt
    }

    // country map
    if (stat.header !== undefined && stat.header.ip) {
        const c = ip2county(stat.header.ip.split(':')[0])
        const ac: Record<string, number> = JSON.parse(dat.ctMap)
        ac[c] = (ac[c] ?? 0) + 1
        dat.ctMap = JSON.stringify(ac)
    }
    SttRd.hmset(key, dat)
}