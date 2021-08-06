import Sche from 'node-schedule'
import { getAppLogger, KEYS, PVoidT } from '@elara/lib'
import { statDump } from './statistic'
import { ProRd, SttRd, UserRd } from './redis'
import { Stats, Statistics, UserAttr, ProAttr } from './interface'
import { lastTime, todayStamp, startStamp } from './util'
import Conf from '../config'
import Http from './http'

const rconf = Conf.getRedis()

const KEY = KEYS.Stat
const uKEY = KEYS.User
const pKEY = KEYS.Project
const log = getAppLogger('service')

async function cleaSttRdayExpire() {
    const dayStamp = startStamp('day', rconf.expire)
    const keys = await SttRd.keys(`*${dayStamp}`)
    log.debug('expire keys: %o', keys)
    for (let k of keys) {
        SttRd.del(k)
    }
}

export async function proFetch(key: string): Promise<Stats> {
    const re = await SttRd.get(key)
    if (re === null) return {} as Stats
    return JSON.parse(re)
}

export async function proUpdate(key: string, dat: Stats): PVoidT {
    SttRd.setex(key, rconf.expire * rconf.expireFactor, JSON.stringify(dat))
}

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
    const pros = await Http.getProjecList()
    pros.forEach(async (pro: ProAttr) => {
        if (pro.status === 'suspend') {
            Http.updateProjectStatus(pro.id, 'active')
            ProRd.hset(pKEY.hProjectStatus(pro.chain, pro.pid), 'status', 'active')
        }
    })
}

async function dailyDashboaSttRdReset(): PVoidT {
    const key = KEY.hDaily()
    // SttRd.del(key)
    SttRd.hmset(key, {
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

async function dailRankReset(): PVoidT {
    SttRd.del(KEY.zDailyReq())
    SttRd.del(KEY.zDailyBw())
}

async function clearHourExpire(): PVoidT {
    const [start, end] = lastTime('hour', 24)
    const zlKey = KEY.zStatList()
    const keys = await SttRd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        log.debug('remove expire statistic: %o', k)
        SttRd.zrem(zlKey, k)
    }

    const zelKey = KEY.zErrStatList()
    const ekeys = await SttRd.zrangebyscore(zelKey, start, end)
    for (let k of ekeys) {
        log.debug('remove expire error statistic: %o', k)
        SttRd.zrem(zelKey, k)
    }
}

async function handleHourStatistic(): PVoidT {
    const [start, end] = lastTime('hour')
    const today = todayStamp()
    const zlKey = KEY.zStatList()

    clearHourExpire()

    const keys = await SttRd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        const skey = `Stat_${k}`
        const kp = skey.split('_')
        const chain = kp[1]
        const pid = kp[2]

        const stat = await SttRd.get(skey)
        if (stat === null) {
            log.error(`get statistic [${skey}] error`)
            SttRd.zrem(zlKey, k)
            continue
        }
        const req = JSON.parse(stat) as Statistics
        statDump(req, KEY.hProDaily(chain, pid, today))

        if (req.proto === 'http') {
            // method of request count & bandwidth rank
            if (req.req === undefined || req.req.method === undefined) {
                continue
            }
            const method: string = req.req.method
            SttRd.zincrby(KEY.zReq(chain, pid, today), 1, method)
            SttRd.zincrby(KEY.zBw(chain, pid, today), req.bw ?? 0, method)
        }
    }
}

namespace Service {
    export async function init() {
        // hourly job
        const hourJob = Sche.scheduleJob('0 */1 * * *', () => {
            log.debug('hourly job start')
            handleHourStatistic()
        })

        hourJob.on('error', (err) => {
            log.error('hourly job error: %o', err)
        })

        hourJob.on('canceled', (reason) => {
            log.debug('hourly job canceled ', reason)
        })

        const dayJob = Sche.scheduleJob('0 0 */1 * *', () => {
            dailyDashboaSttRdReset()
            dailRankReset()
            cleaSttRdayExpire()
            userStatUpdate()
        })

        dayJob.on('error', (err) => {
            log.error('daily job error: %o', err)
        })

        dayJob.on('canceled', (reason) => {
            log.debug('daily job canceled ', reason)
        })
    }
}

export default Service