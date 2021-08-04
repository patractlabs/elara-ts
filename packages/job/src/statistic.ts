import geo from 'geoip-country'
import { getAppLogger, md5, KEYS, PVoidT } from '@elara/lib'
import { Rd } from './redis'
import { Statistics, StatT, Stats } from './interface'
import Conf from '../config'

const log = getAppLogger('statistic')
const KEY = KEYS.Stat
const rconf = Conf.getRedis()

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

function parseStatRecord(stat: Record<string, string>): StatT {
    return {
        wsReqNum: parseInt(stat.wsReqNum ?? '0'),
        wsConn: parseInt(stat.wsConn ?? '0'),
        wsSubNum: parseInt(stat.wsSubNum ?? '0'),
        wsSubResNum: parseInt(stat.wsSubResNum ?? '0'),
        wsCt: stat.wsCt ?? '{}',
        wsBw: parseInt(stat.wsBw ?? '0'),
        wsDelay: parseFloat(stat.wsDelay ?? '0.0'),
        wsInReqNum: parseInt(stat.wsInReqNum ?? '0'),
        wsTimeout: parseFloat(stat.wsTimeout ?? '0'),
        wsTimeoutCnt: parseInt(stat.wsTimeoutCnt ?? '0'),

        httpReqNum: parseInt(stat.httpReqNum ?? '0'),
        httpCt: stat.httpCt ?? '{}',
        httpBw: parseInt(stat.httpBw ?? '0'),
        httpDelay: parseFloat(stat.httpDelay ?? '0'),
        httpInReqNum: parseInt(stat.httpInReqNum ?? '0'),
        httpTimeout: parseFloat(stat.httpTimeout ?? '0'),
        httpTimeoutCnt: parseInt(stat.httpTimeoutCnt ?? '0')
    }
}

function asNum(val: number | string): number {
    return (val as number) ?? 0
}

export async function statDump(req: Statistics, key: string): PVoidT {
    const dat = parseStatRecord(await Rd.hgetall(key)) as unknown as Stats
    const curNum = req.proto === 'ws' ? dat.wsReqNum : dat.httpReqNum
    const curDelay = req.proto === 'ws' ? dat.wsDelay : dat.httpDelay

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
        log.debug('parse country: %o %o',key, dat[`${req.proto}Ct`])
        const ac: Record<string, number> = JSON.parse(dat[`${req.proto}Ct`] as string)
        ac[c] = (ac[c] ?? 0) + 1
        dat[`${req.proto}Ct`] = JSON.stringify(ac)
    }
    Rd.hmset(key, dat)
}

export async function dailyStatDump(req: Statistics, key: string): PVoidT {
    const curNum: number = parseInt(await Rd.hget(key, `${req.proto}ReqNum`) ?? '0')
    const curDelay: number = parseInt(await Rd.hget(key, `${req.proto}Delay`) ?? '0')
    if (req.timeout) {
        Rd.hincrby(key, `${req.proto}TimeoutCnt`, 1)
        Rd.hset(key, `${req.proto}Timeout`, accAverage(curNum, curDelay, req.delay ?? 0))
    } else {
        Rd.hset(key, `${req.proto}Delay`, accAverage(curNum, curDelay, req.delay ?? 0))
    }
    if (req.proto === 'ws' && req.reqCnt) {
        Rd.hincrby(key, `wsSubNum`, 1)
        Rd.hincrby(key, `wsSubResNum`, req.reqCnt)
    }
    Rd.hincrby(key, `${req.proto}ReqNum`, 1)
    // ws connection cnt
    if (req.type === 'conn') {
        Rd.hincrby(key, 'wsConn', 1)
    }
    if (req.bw !== undefined) {
        Rd.hincrby(key, `${req.proto}Bw`, req.bw)
    }
    if (req.code !== 200) {
        Rd.hincrby(key, `${req.proto}InReqNum`, 1)
    }

    // country access
    if (req.header !== undefined && req.header.ip) {
        const c = ip2county(req.header.ip.split(':')[0])
        const ac: Record<string, number> = JSON.parse(await Rd.hget(key, `${req.proto}Ct`) ?? '{}')
        ac[c] = (ac[c] ?? 0) + 1
        Rd.hset(key, `${req.proto}Ct`, JSON.stringify(ac))
    }
}

export async function handleStat(stream: string[]): PVoidT {
    const dat = stream[1][1]
    const req = JSON.parse(dat) as Statistics
    const key = md5(dat)
    log.debug('dump new request statistic: %o %o',key, dat)
    try {
        if (req.code === 200) {
            // request record
            Rd.setex(KEY.stat(req.chain, req.pid, key), rconf.expireFactor + 3600, dat)
            // Rd.setex(KEY.stat(req.chain, req.pid, key), 120, dat)    // for test
            Rd.zadd(KEY.zStatList(), req.reqtime, `${req.chain}_${req.pid}_${key}`)
        } else {
            // keep one day error record
            Rd.setex(KEY.errStat(req.chain, req.pid, key), 3600 * 24, dat)
            Rd.zadd(KEY.zErrStatList(), req.reqtime, `${req.chain}_${req.pid}_${key}`)
        }

        // daily statistic
        // dailyStatDump(req, KEY.hTotal())
        statDump(req, KEY.hTotal())

        // dailyStatDump(req, KEY.hChainTotal(req.chain))
        statDump(req, KEY.hChainTotal(req.chain))

        // dailyStatDump(req, KEY.hDaily())
        statDump(req, KEY.hDaily())

        // most request & bandwidth
        if (req.proto === 'http') {
            Rd.zincrby(KEY.zDailyReq(), 1, req.req.method)
            Rd.zincrby(KEY.zDailyBw(), req.bw ?? 0, req.req.method)
        }
    } catch (err) {
        log.error(`dump request statistic [${req.chain}-${req.pid}] error: %o`, err)
    }
}