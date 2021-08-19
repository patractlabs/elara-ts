import Sche from 'node-schedule'
import { getAppLogger, KEYS, PVoidT, isErr, md5 } from '@elara/lib'
import { ProRd, SttRd, UserRd } from './redis'
import { Statistics, UserAttr, ProAttr, StatT } from './interface'
import { lastTime, todayStamp, currentHourStamp, startStamp, statisticDump, parseStatInfo, ip2county } from './util'
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

    const ekeys = await SttRd.keys(`Z_Stat_Err_*_list`)
    for (let k of ekeys) {
        keys = await SttRd.zrangebyscore(k, start, end)
        for (let ik of keys) {
            SttRd.zrem(k, ik)
        }
        log.debug('remove expire error request statistic: %o', k)
    }
}

async function dailyHandler(): PVoidT {
    // const start = startStamp(1, 'day')
    const start = startStamp(rconf.expire, 'day')

    // clear expre total daily record
    SttRd.del(KEY.hDaily(start))

    // stat records
    const keys: string[] = await SttRd.keys(`H_Stat_day_*_${start}`)
    log.debug(`clear expire daily statistic: %o`, keys)
    for (let k of keys) {
        log.debug('remove expire daily statistic: %o', k)
        SttRd.del(k)
    }
    // method records
    const mkeys = await SttRd.keys(`Z_Method_*_${start}`)
    for (let key of mkeys) {
        const sp = key.split('_')
        const typ = sp[2]
        const chain = sp[3]
        const pid = sp[4]
        log.debug(`clear expire method statistic: ${typ} ${chain} ${pid}`)
        if (typ === 'bw') {
            const re = await SttRd.zrange(key, 0, -1, 'WITHSCORES')
            for (let i = 0; i < re.length; i += 2) {
                log.debug(`decr total method bandwidth rank: ${re[i]} ${re[i + 1]}`)
                SttRd.zincrby(KEY.zProBw(chain, pid), -re[i + 1], re[i])
            }
        } else {
            const re = await SttRd.zrange(key, 0, -1, 'WITHSCORES')
            for (let i = 0; i < re.length; i += 2) {
                log.debug(`decr total method request rank: ${re[i]} ${re[i + 1]}`)
                SttRd.zincrby(KEY.zProReq(chain, pid), -re[i + 1], re[i])
            }
        }
        SttRd.del(key)
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

            const keys = [
                KEY.hTotal(),
                KEY.hChainTotal(req.chain),
                KEY.hDaily(today),
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
            // 30 days statistic
            SttRd.zincrby(KEY.zProBw(chain, pid), parseInt(req.bw?.toString() ?? '0'), method)
            SttRd.zincrby(KEY.zProReq(chain, pid), 1, method)
            // daily reord
            SttRd.zincrby(KEY.zProDailyBw(chain, pid, today), parseInt(req.bw?.toString() ?? '0'), method)
            SttRd.zincrby(KEY.zProDailyReq(chain, pid, today), 1, method)

            // country request map
            SttRd.zincrby(KEY.zProDailyCtmap(chain, pid), 1, ip2county(req.header.ip.split(':')[0]))
            SttRd.zincrby(KEY.zProDailyCtmap(chain, pid), 1, 'total')

            const now = moment().utc(true)
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
                // keep oneday
                SttRd.setex(KEY.errStat(req.chain, req.pid, key), rconf.expireFactor + 3600, errStat)
                SttRd.zadd(KEY.zErrStatList(chain, pid), now.valueOf(), `${req.chain}_${req.pid}_${key}`)
            }
            // disalbe now
            // else {
            //     // latest statistic
            //     const reqStat = JSON.stringify({
            //         proto: req.proto,
            //         method: req.req.method,
            //         origin: req.header.origin,
            //         agent: req.header.agent,
            //         ip: req.header.ip,
            //         delay: req.delay ?? 0,
            //         time: now
            //     })
            //     SttRd.setex(KEY.stat(req.chain, req.pid, key), rconf.expireFactor + 3600, reqStat)
            //     SttRd.zadd(KEY.zStatList(), now.valueOf(), `${req.chain}_${req.pid}_${key}`)
            // }
            if (pid !== '00000000000000000000000000000000') {
                resourceCheck(chain, pid)
            }
        } catch (err) {
            log.error(`dump request statistic [${req.chain}-${req.pid}] error: %o`, err)
        }
    }
}

export default Service