import Http from 'http'
import geo from 'geoip-country'
import { getAppLogger, md5, KEYS, PVoidT, IDT } from '@elara/lib'
import Conf from '../config'
import { Rd } from './redis'

const log = getAppLogger('statistic')
const KEY = KEYS.Stat
const redis = Conf.getRedis()

interface ReqDataT {
    id: IDT,
    jsonrpc: string,
    method: string,
    params?: any[]
}

interface Statistics {
    proto: string,   // http ws
    chain: string,
    pid: string,
    method: string,
    req: ReqDataT,
    reqtime: number,     // request start time
    code: number,        // 200 400 500
    header?: Http.IncomingHttpHeaders,
    start: number,
    type?: string,       // noder kv cacher recorder
    delay?: number,      // ms
    bw?: number,         // bytes
    timeout?: boolean,   // timeout threshold 1s
    reqCnt?: number,     // for subscribe
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

async function dailyDashboardDump(req: Statistics): PVoidT {
    const dayKey = KEY.hDaily()
    const curNum: number = parseInt(await Rd.hget(dayKey, `${req.proto}ReqNum`) ?? '0')
    const curDelay: number = parseInt(await Rd.hget(dayKey, `${req.proto}Delay`) ?? '0')
    if (req.timeout) {
        Rd.hincrby(dayKey, `${req.proto}TimeoutCnt`, 1)
        Rd.hset(dayKey, `${req.proto}Timeout`, accAverage(curNum, curDelay, req.delay ?? 0))
    } else {
        Rd.hset(dayKey, `${req.proto}Delay`, accAverage(curNum, curDelay, req.delay ?? 0))
    }
    let reqCnt = 1
    if (req.proto === 'ws') {
        reqCnt = req.reqCnt ?? 0
    }
    Rd.hincrby(dayKey, `${req.proto}ReqNum`, reqCnt)
    // ws connection cnt
    if (req.type === 'conn') {
        Rd.hincrby(dayKey, 'wsConn', 1)
    }
    if (req.bw !== undefined) {
        Rd.hincrby(dayKey, `${req.proto}Bw`, req.bw)
    }
    if (req.code !== 200) {
        Rd.hincrby(dayKey, `${req.proto}InReqNum`, 1)
    }

    // country access
    if (req.header !== undefined && req.header.host) {
        const c = ip2county(req.header.host)
        const ac: Record<string, number> = JSON.parse(await Rd.hget(dayKey, `${req.proto}Ct`) ?? '{}')
        log.debug('country parse: ', c, ac)
        ac[c] = (ac[c] ?? 0) + 1
        Rd.hset(dayKey, `${req.proto}Ct`, JSON.stringify(ac))
    }
}

export async function dailyDashboardReset(): PVoidT {
    const dayKey = KEY.hDaily()
    // Rd.del(dayKey)
    Rd.hmset(dayKey, {
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
    })
    log.debug('reset daily statistic')
}

async function dumpStatistic(stream: string): PVoidT {
    const req = JSON.parse(stream) as Statistics
    const key = md5(stream)
    log.debug('dump request statistic: ', key, req.reqtime)
    try {
        // request record
        Rd.setex(KEY.stat(req.chain, req.pid, key), redis.expiration, stream)
        Rd.zadd(KEY.zStatList(), req.reqtime, key)

        // daily statistic
        dailyDashboardDump(req)

    } catch (err) {
        log.error(`dump request statistic [${req.chain}-${req.pid}] error: `, err)
    }
}

export async function handleStat(stream: string[]): PVoidT {
    const req = JSON.parse(stream[1][1]) as Statistics
    log.debug('get new statistic: ', stream, req.code, req.header.host)
    const key = md5(stream)
    log.debug('dump request statistic: ', key, req.reqtime)
    try {
        // request record
        Rd.setex(KEY.stat(req.chain, req.pid, key), redis.expiration, stream)
        Rd.zadd(KEY.zStatList(), req.reqtime, key)

        // daily statistic
        dailyDashboardDump(req)

    } catch (err) {
        log.error(`dump request statistic [${req.chain}-${req.pid}] error: `, err)
    }
}