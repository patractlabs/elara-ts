import { getAppLogger, md5, KEYS, PVoidT, isErr } from '@elara/lib'
import { ProRd, SttRd, UserRd } from './redis'
import { Statistics, StatT, Stats, ProAttr } from './interface'
import Conf from '../config'
import HttpUtil from './http'

const log = getAppLogger('statistic')
const KEY = KEYS.Stat
const pKEY = KEYS.Project
const uKEY = KEYS.User
const rconf = Conf.getRedis()

function accAverage(num: number, av: number, val: number, fixed: number = 2): number {
    return parseFloat((av / (num + 1) * num + val / (num + 1)).toFixed(fixed))
}

function ip2county(ip: string): string {
    // TODO
    return ip
    // const dat = geo.lookup(ip)
    // if (dat) {
    //     return dat.country
    // }
    // return 'unknow'
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

async function checkProjecLimit(dat: Stats, pro: ProAttr) {
    // check project limit
    const reqCnt = asNum(dat.httpReqNum) + asNum(dat.wsReqNum) + asNum(dat.httpInReqNum) + asNum(dat.wsInReqNum)
    const bw = asNum(dat.httpBw) + asNum(dat.wsBw)
    const reqLimit = pro.reqDayLimit !== -1 && reqCnt >= pro.reqDayLimit
    const bwLimit = pro.bwDayLimit !== -1 && bw >= pro.bwDayLimit
    if (reqLimit || bwLimit) {
        // set suspend
        HttpUtil.updateProjectStatus(pro.id, 'suspend')

        // cache
        ProRd.hset(pKEY.hProjectStatus(pro.chain, pro.pid), 'status', 'suspend')
    }
}

async function checkUserLimit(userId: number) {
    const ure = await HttpUtil.getUserWithLimit(userId)
    if (isErr(ure)) {
        log.error(`check user error: %o`, ure.value)
        return
    }
    const user = ure.value as any // UserModel
    const limit = user.limit
    if (!limit) {
        log.error(`check user limit error: invalid user model`)
        return
    }
    const re = await HttpUtil.getUserDailyStatistic(userId)
    if (isErr(re)) {
        log.error(`check user resource limit error: %o`, re.value)
        return
    }
    const stat = re.value
    const reqCnt = stat.httpReqNum + stat.wsReqNum + stat.httpInReqNum + stat.wsInReqNum
    const bw = stat.httpBw + stat.wsBw
    
    if (reqCnt >= limit.reqDayLimit || bw >= limit.bwDayLimit) {
        HttpUtil.updateUserStatus(user.githubId, 'suspend')
        // cache
        UserRd.hset(uKEY.hStatus(userId), 'status', 'suspend')
    }
}

export async function statDump(req: Statistics, key: string): PVoidT {
    const dat = parseStatRecord(await SttRd.hgetall(key)) as unknown as Stats
    if (key != KEY.hDaily() && key != KEY.hTotal()) {
        const ks = key.split('_')
        const chain = ks[3]
        const pid = ks[4]
        const re = await HttpUtil.getProject(chain, pid)

        if (isErr(re)) {
            log.error(`check ${chain} project [${pid}] error: %o`, re.value)
        } else {
            checkProjecLimit(dat, re.value)
            checkUserLimit(re.value.userId)
        }
    }

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
        log.debug('parse country: %o %o', key, dat[`${req.proto}Ct`])
        const ac: Record<string, number> = JSON.parse(dat[`${req.proto}Ct`] as string)
        ac[c] = (ac[c] ?? 0) + 1
        dat[`${req.proto}Ct`] = JSON.stringify(ac)
    }
    SttRd.hmset(key, dat)
}

export async function dailyStatDump(req: Statistics, key: string): PVoidT {
    const curNum: number = parseInt(await SttRd.hget(key, `${req.proto}ReqNum`) ?? '0')
    const curDelay: number = parseInt(await SttRd.hget(key, `${req.proto}Delay`) ?? '0')
    if (req.timeout) {
        SttRd.hincrby(key, `${req.proto}TimeoutCnt`, 1)
        SttRd.hset(key, `${req.proto}Timeout`, accAverage(curNum, curDelay, req.delay ?? 0))
    } else {
        SttRd.hset(key, `${req.proto}Delay`, accAverage(curNum, curDelay, req.delay ?? 0))
    }
    if (req.proto === 'ws' && req.reqCnt) {
        SttRd.hincrby(key, `wsSubNum`, 1)
        SttRd.hincrby(key, `wsSubResNum`, req.reqCnt)
    }
    SttRd.hincrby(key, `${req.proto}ReqNum`, 1)
    // ws connection cnt
    if (req.type === 'conn') {
        SttRd.hincrby(key, 'wsConn', 1)
    }
    if (req.bw !== undefined) {
        SttRd.hincrby(key, `${req.proto}Bw`, req.bw)
    }
    if (req.code !== 200) {
        SttRd.hincrby(key, `${req.proto}InReqNum`, 1)
    }

    // country access
    if (req.header !== undefined && req.header.ip) {
        const c = ip2county(req.header.ip.split(':')[0])
        const ac: Record<string, number> = JSON.parse(await SttRd.hget(key, `${req.proto}Ct`) ?? '{}')
        ac[c] = (ac[c] ?? 0) + 1
        SttRd.hset(key, `${req.proto}Ct`, JSON.stringify(ac))
    }
}

export async function handleStat(stream: string[]): PVoidT {
    const dat = stream[1][1]
    const req = JSON.parse(dat) as Statistics
    const key = md5(dat)
    log.debug('dump new request statistic: %o %o', key, dat)
    try {
        if (req.code === 200) {
            // request record
            SttRd.setex(KEY.stat(req.chain, req.pid, key), rconf.expireFactor + 3600, dat)
            SttRd.zadd(KEY.zStatList(), req.reqtime, `${req.chain}_${req.pid}_${key}`)
        } else {
            // keep one day error record
            SttRd.setex(KEY.errStat(req.chain, req.pid, key), 3600 * 24, dat)
            SttRd.zadd(KEY.zErrStatList(), req.reqtime, `${req.chain}_${req.pid}_${key}`)
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
            SttRd.zincrby(KEY.zDailyReq(), 1, req.req.method)
            SttRd.zincrby(KEY.zDailyBw(), req.bw ?? 0, req.req.method)
        }
    } catch (err) {
        log.error(`dump request statistic [${req.chain}-${req.pid}] error: %o`, err)
    }
}