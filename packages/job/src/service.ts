import Sche from 'node-schedule'
import { getAppLogger, KEYS, PVoidT, isErr, md5 } from '@elara/lib'
import { ProRd, SttRd, UserRd } from './redis'
import { Statistics, UserAttr, ProAttr, StatT, StatRedisT } from './interface'
import { lastTime, todayStamp, currentHourStamp, startStamp, statisticDump, parseStatInfo } from './util'
import Conf from '../config'
import Http from './http'
import moment from 'moment'

const rconf = Conf.getRedis()

const KEY = KEYS.Stat
const uKEY = KEYS.User
const pKEY = KEYS.Project
const log = getAppLogger('service')

async function userStatUpdate(): PVoidT {
    const users = await Http.getUserList()
    users.forEach(async (user: UserAttr) => {
        if (user.status === 'suspend') {
            Http.updateUserStatus(user.githubId!, 'active')
            UserRd.hset(uKEY.hStatus(user.id), 'status', 'active')
            projectStatUpdate(user.id)
        }
    })
}

async function projectStatUpdate(userId: number): PVoidT {
    log.debug(`ready to update projects status of user[${userId}]`)
    const pros = await Http.getProjecList(userId)
    pros.forEach(async (pro: ProAttr) => {
        if (pro.status === 'suspend') {
            Http.updateProjectStatus(pro.id, 'active')
            ProRd.hset(pKEY.hProjectStatus(pro.chain, pro.pid), 'status', 'active')
        }
    })
}

async function dailyDashboardReset(): PVoidT {
    const key = KEY.hDaily()
    // SttRd.del(key)
    SttRd.hmset(key, {
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
    } as StatRedisT)
    log.debug('reset daily statistic')
}

async function checkProjecLimit(dat: StatT, pro: ProAttr) {
    const reqLimit = pro.reqDayLimit !== -1 && dat.reqCnt >= pro.reqDayLimit
    const bwLimit = pro.bwDayLimit !== -1 && dat.bw >= pro.bwDayLimit
    if (reqLimit || bwLimit) {
        // set suspend
        Http.updateProjectStatus(pro.id, 'suspend')

        // cache
        ProRd.hset(pKEY.hProjectStatus(pro.chain, pro.pid), 'status', 'suspend')
    }
}

async function checkUserLimit(userId: number) {
    const ure = await Http.getUserWithLimit(userId)
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
    const re = await Http.getUserDailyStatistic(userId)
    if (isErr(re)) {
        log.error(`check user resource limit error: %o`, re.value)
        return
    }
    const stat = re.value

    if (stat.reqCnt >= limit.reqDayLimit || stat.bw >= limit.bwDayLimit) {
        Http.updateUserStatus(user.githubId, 'suspend')
        // cache
        UserRd.hset(uKEY.hStatus(userId), 'status', 'suspend')
    }
}

async function resourceCheck(chain: string, pid: string) {
    const re = await Http.getProject(chain, pid)
    const key = KEY.hProDaily(chain, pid, todayStamp())
    const dat = parseStatInfo(await SttRd.hgetall(key))

    if (isErr(re)) {
        log.error(`check ${chain} project [${pid}] error: %o`, re.value)
    } else {
        checkProjecLimit(dat, re.value)
        checkUserLimit(re.value.userId)
    }
}

async function hourlyHandler(): PVoidT {
    // clear 24 hours expiration record
    const [start, end] = lastTime('hour', 24)
    let keys = await SttRd.keys(`H_Stat_hour_*_${start}`)
    log.debug(`clear expire hourly statistic: %o`, keys)
    for (let k of keys) {
        log.debug('remove expire hourly statistic: %o', k)
        SttRd.del(`H_Stat_hour_${k}`)
    }

    const zlKey = KEY.zStatList()
    keys = await SttRd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        log.debug('remove expire request statistic: %o', k)
        SttRd.zrem(zlKey, k)
    }

    const zelKey = KEY.zErrStatList()
    keys = await SttRd.zrangebyscore(zelKey, start, end)
    for (let k of keys) {
        log.debug('remove expire error request statistic: %o', k)
        SttRd.zrem(zelKey, k)
    }
}

async function dailyHandler(): PVoidT {
    // const [start, _end] = lastTime('day', 1)    // for test
    const start = startStamp('day', rconf.expire)
    let keys: string[] = []

    // stat records
    keys.push(...(await SttRd.keys(`H_Stat_day_*_${start}`)))

    // method records
    keys.push(...(await SttRd.keys(`Z_Method_*_${start}`)))
    log.debug(`clear expire daily statistic: %o`, keys)
    for (let k of keys) {
        log.debug('remove expire daily statistic: %o', k)
        SttRd.del(k)
    }

    // country map reset
    const ckeys = await SttRd.keys(`Z_Country_daily_*`)
    for (let key of ckeys) {
        SttRd.del(key)
    }
}

class Service {
    static async init() {
        // hourly job
        const hourJob = Sche.scheduleJob('0 */1 * * *', () => {
            log.debug('hourly job start')
            hourlyHandler()
        })

        hourJob.on('error', (err) => {
            log.error('hourly job error: %o', err)
        })

        hourJob.on('canceled', (reason) => {
            log.debug('hourly job canceled ', reason)
        })

        const dayJob = Sche.scheduleJob('0 0 */1 * *', () => {
            dailyDashboardReset()
            userStatUpdate()
            dailyHandler()
        })

        dayJob.on('error', (err) => {
            log.error('daily job error: %o', err)
        })

        dayJob.on('canceled', (reason) => {
            log.debug('daily job canceled ', reason)
        })
    }

    static async handleStat(stream: string[]): PVoidT {
        const data = stream[1][1]
        const req = JSON.parse(data) as Statistics
        const { chain, pid } = req

        log.debug('dump new request statistic: %o', data)
        try {
            const today = todayStamp()

            const keys = [KEY.hTotal(), KEY.hChainTotal(req.chain), KEY.hDaily(),
            KEY.hProDaily(chain, pid, today),
            KEY.hProHourly(chain, pid, currentHourStamp())
            ]
            let dat: StatT
            // stat statistic
            for (let key of keys) {
                log.debug(`statistic dump key: %o`, key)
                dat = parseStatInfo(await SttRd.hgetall(key))
                statisticDump(req, key, dat)
            }

            // method statistic, keep 30 days
            const method = req.req.method
            SttRd.zincrby(KEY.zProDailyBw(chain, pid, today), parseInt(req.bw?.toString() ?? '0'), method)
            SttRd.zincrby(KEY.zProDailyReq(chain, pid, today), 1, method)

            // country request map
            SttRd.zincrby(KEY.zProDailyCtmap(chain, pid), 1, req.header.ip.split(':')[0])

            const now = moment()
            const key = md5(data)
            if (req.code !== 200) {
                // error statistic
                const errStat = JSON.stringify({
                    proto: req.proto,
                    method: req.req.method,
                    code: req.code,
                    delay: req.delay ?? 0,
                    time: now
                })
                SttRd.setex(KEY.errStat(req.chain, req.pid, key), rconf.expireFactor + 3600, errStat)
                SttRd.zadd(KEY.zErrStatList(), now.valueOf(), `${req.chain}_${req.pid}_${key}`)
            } else {
                // latest statistic
                const reqStat = JSON.stringify({
                    proto: req.proto,
                    method: req.req.method,
                    origin: req.header.origin,
                    agent: req.header.agent,
                    ip: req.header.ip,
                    delay: req.delay ?? 0,
                    time: now
                })
                SttRd.setex(KEY.stat(req.chain, req.pid, key), rconf.expireFactor + 3600, reqStat)
                SttRd.zadd(KEY.zStatList(), now.valueOf(), `${req.chain}_${req.pid}_${key}`)
            }
            resourceCheck(chain, pid)
        } catch (err) {
            log.error(`dump request statistic [${req.chain}-${req.pid}] error: %o`, err)
        }
    }
}

export default Service