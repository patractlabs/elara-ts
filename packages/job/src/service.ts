import Sche from 'node-schedule'
import { getAppLogger, KEYS, PVoidT } from '@elara/lib'
import { statDump } from './statistic'
import { Rd } from './redis'
import { Stats, Statistics } from './interface'
import { lastTime, todayStamp, startStamp } from './util'
import Conf from '../config'

const rconf = Conf.getRedis()
const KEY = KEYS.Stat
const log = getAppLogger('service')

async function clearDayExpire() {
    const dayStamp = startStamp('day', rconf.expire)
    const keys = await Rd.keys(`*${dayStamp}`)
    log.debug('expire keys: ', keys)
    for (let k of keys) {
        Rd.del(k)
    }
}

export async function proFetch(key: string): Promise<Stats> {
    const re = await Rd.get(key)
    if (re === null) return {} as Stats
    return JSON.parse(re)
}

export async function proUpdate(key: string, dat: Stats): PVoidT {
    Rd.setex(key, rconf.expire * rconf.expireFactor, JSON.stringify(dat))
}

async function accountStatUpdate() {
    log.debug('TODO: update account status')
}

async function dailyDashboardReset(): PVoidT {
    const key = KEY.hDaily()
    // Rd.del(key)
    Rd.hmset(key, {
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
    Rd.del(KEY.zDailyReq())
    Rd.del(KEY.zDailyBw())
}

async function clearHourExpire(): PVoidT {
    const [start, end] = lastTime('hour', 24)
    const zlKey = KEY.zStatList()
    const keys = await Rd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        log.debug('remove expire statistic: ', k)
        Rd.zrem(zlKey, k)
    }
}

async function handleHourStatistic(): PVoidT {
    const [start, end] = lastTime('hour')
    const today = todayStamp()
    const zlKey = KEY.zStatList()

    clearHourExpire()

    const keys = await Rd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        const skey = `Stat_${k}`
        const kp = skey.split('_')
        const chain = kp[1]
        const pid = kp[2]

        const stat = await Rd.get(skey)
        if (stat === null) {
            log.error(`get statistic [${skey}] error`)
            Rd.zrem(zlKey, k)
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
            Rd.zincrby(KEY.zReq(chain, pid, today), 1, method)
            Rd.zincrby(KEY.zBw(chain, pid, today), req.bw ?? 0, method)
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
            log.error('hourly job error: ', err)
        })

        hourJob.on('canceled', (reason) => {
            log.debug('hourly job canceled ', reason)
        })

        const dayJob = Sche.scheduleJob('0 0 */1 * *', () => {
            dailyDashboardReset()
            dailRankReset()
            clearDayExpire()
            accountStatUpdate()
        })

        dayJob.on('error', (err) => {
            log.error('daily job error: ', err)
        })

        dayJob.on('canceled', (reason) => {
            log.debug('daily job canceled ', reason)
        })
    }
}

export default Service