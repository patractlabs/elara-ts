import Sche from 'node-schedule'
import Mom from 'moment'
import { getAppLogger, KEYS, PVoidT } from '@elara/lib'
import { dailyDashboardReset, dailyStatDump } from './statistic'
import { Rd } from './redis'
import { Stat, Statistics, StartT, DurationT } from './interface'
import { lastTimes } from './util'
import Conf from '../config'

const rconf = Conf.getRedis()
const KEY = KEYS.Stat
const log = getAppLogger('service')

const tz = 'Etc/GMT+8'

async function clearExpireStat(time: number) {
    const expDay = rconf.expire
    const stamp = Mom(time).subtract(expDay, `${rconf.expireUnit}s` as DurationT).startOf(rconf.expireUnit as StartT)
    // const stamp = Mom(time).subtract(expDay, 'minutes').startOf('minute')
    const keys = await Rd.keys(`*${stamp.valueOf()}`)
    log.debug('expire keys: ', keys)
    for (let k of keys) {
        Rd.del(k)
    }

    // Rd.zadd(KEY.zExpireList(), time, time)
    log.debug('expire end day: ', stamp, stamp.valueOf())
}

export async function proFetch(key: string): Promise<Stat> {
    const re = await Rd.get(key)
    if (re === null) return {} as Stat
    return JSON.parse(re)
}

export async function proUpdate(key: string, dat: Stat): PVoidT {
    Rd.setex(key, rconf.expire * rconf.expireFactor, JSON.stringify(dat))
}

async function handleExpireStat() {
    // const date = new Date()
    // let [start, end] = lastTimes('day', 1)
    let [start, end] = lastTimes('minute', 1)      // for test

    clearExpireStat(start)
    const zlKey = KEY.zStatList()
    const keys = await Rd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        const skey = `Stat_${k}`
        const kp = skey.split('_')
        const chain = kp[1]
        const pid = kp[2]
        log.debug('chain-pid: ', chain, pid)
        // wrap statistic by chain pid
        const stat = await Rd.get(skey)
        if (stat === null) {
            log.error('get statistic error')
            Rd.zrem(zlKey, k)
            Rd.del(skey)
            continue
        }
        const req = JSON.parse(stat) as Statistics
        dailyStatDump(req, KEY.hProDaily(chain, pid, start))
        // score rank
        if (req.req === undefined || req.req.method === undefined) {
            Rd.zrem(zlKey, k)
            Rd.del(skey)
            continue
        }
        const method: string = req.req.method
        if (req.proto === 'http') {
            Rd.zincrby(KEY.zReq(chain, pid, start), 1, method)
            Rd.zincrby(KEY.zBw(chain, pid, start), req.bw ?? 0, method)
        }
        // TODO websocket statis
        Rd.zrem(zlKey, k)
        Rd.del(skey)
    }
}

async function accountStatUpdate() {
    log.debug('TODO: update account status')
}

namespace Service {
    export async function init(rule: string) {
        const job = Sche.scheduleJob({ rule, tz }, () => {
            dailyDashboardReset()
            handleExpireStat()
            accountStatUpdate()
        })

        job.on('error', (err) => {
            log.error('job error: ', err)
        })

        job.on('canceled', (reason) => {
            log.debug('job canceled ', reason)
        })
    }
}

export default Service