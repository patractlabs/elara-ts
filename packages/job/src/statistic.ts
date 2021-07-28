import geo from 'geoip-country'
import { getAppLogger, md5, KEYS, PVoidT } from '@elara/lib'
import { Rd } from './redis'
import { Statistics } from './interface'
import Conf from '../config'

const log = getAppLogger('statistic')
const KEY = KEYS.Stat
const rconf = Conf.getRedis()

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

export async function dailyStatDump(req: Statistics, key: string): PVoidT {
    const curNum: number = parseInt(await Rd.hget(key, `${req.proto}ReqNum`) ?? '0')
    const curDelay: number = parseInt(await Rd.hget(key, `${req.proto}Delay`) ?? '0')
    if (req.timeout) {
        Rd.hincrby(key, `${req.proto}TimeoutCnt`, 1)
        Rd.hset(key, `${req.proto}Timeout`, accAverage(curNum, curDelay, req.delay ?? 0))
    } else {
        Rd.hset(key, `${req.proto}Delay`, accAverage(curNum, curDelay, req.delay ?? 0))
    }
    let reqCnt = 1
    if (req.proto === 'ws') {
        reqCnt = req.reqCnt ?? 0
    }
    Rd.hincrby(key, `${req.proto}ReqNum`, reqCnt)
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
        log.debug('country parse: ', c, ac)
        ac[c] = (ac[c] ?? 0) + 1
        Rd.hset(key, `${req.proto}Ct`, JSON.stringify(ac))
    }
}

export async function handleStat(stream: string[]): PVoidT {
    const dat = stream[1][1]
    const req = JSON.parse(dat) as Statistics
    const key = md5(dat)
    log.debug('dump new request statistic: ', key, dat)
    try {
        // request record
        Rd.setex(KEY.stat(req.chain, req.pid, key), rconf.statKeep * rconf.expireFactor, dat)
        // Rd.setex(KEY.stat(req.chain, req.pid, key), 120, dat)    // for test
        Rd.zadd(KEY.zStatList(), req.reqtime, `${req.chain}_${req.pid}_${key}`)

        // daily statistic
        dailyStatDump(req, KEY.hTotal())

        dailyStatDump(req, KEY.hChainTotal(req.chain))

        dailyStatDump(req, KEY.hDaily())

        // most request & bandwidth
        if (req.proto === 'http') {
            Rd.zincrby(KEY.zDailyReq(), 1, req.req.method)
            Rd.zincrby(KEY.zDailyBw(), req.bw ?? 0, req.req.method)
        }
    } catch (err) {
        log.error(`dump request statistic [${req.chain}-${req.pid}] error: `, err)
    }
}