import Sche from 'node-schedule'
import Mom from 'moment'
import { getAppLogger, KEYS } from '@elara/lib'
import { dailyDashboardReset } from './statistic'
import { Rd } from './redis'

const KEY = KEYS.Stat
const log = getAppLogger('service')

const tz = 'Etc/GMT+8'
const dayRule = '* 0 * * *'

type StartT = Mom.unitOfTime.StartOf

export function lastTime(time: string, unit: number = 1): number[] {
    const last = Mom().subtract(unit, `${time}s` as Mom.unitOfTime.DurationConstructor)
    const start = last.startOf(time as StartT).clone()
    const end = last.endOf(time as StartT)
    log.debug(`last start-end of ${unit} ${time}: `, start, end)
    return [start.valueOf(), end.valueOf()]
}

export function lastTimes(time: string, unit: number = 1): number[] {
    const cur = Mom()
    const last = cur.clone().subtract(unit, `${time}s` as Mom.unitOfTime.DurationConstructor)
    const start = last.startOf(time as StartT).clone()
    const end = cur.startOf(time as StartT)
    log.debug(`last start-end of ${unit} ${time}s: `, start, end)
    return [start.valueOf(), end.valueOf()]
}

async function handleExpireStat() {
    // const date = new Date()
    // let [start, end] = lastTimes('day', 1)
    let [start, end] = lastTimes('minute', 30)      // for test
    log.debug('start-end: ', start, end)
    const zlKey = KEY.zStatList()
    const keys = await Rd.zrangebyscore(zlKey, start, end)
    for (let k of keys) {
        const key = KEY.patStat(undefined, undefined, k)
        log.debug('statistic key: ', k, key)
        const re = await Rd.keys(key)
        log.debug('pattern keys: ', re)
        if (re === null || re.length < 1) {
            Rd.zrem(zlKey, k)
            continue
        }
        const skey = re[0]  // real stat key
        const kp = skey.split('_')
        const chain = kp[1]
        const pid = kp[2]
        log.debug('chain-pid: ', chain, pid)
        
    }
}

const dailyJob = Sche.scheduleJob(
    {
        rule: dayRule,
        tz
    },
    () => {
        log.debug('daily schedule: ')
    })


dailyJob.on('canceled', () => {
    log.debug('daily job cancel')
})

dailyJob.on('error', () => {
    log.debug('daily job error')
})


const minJob = Sche.scheduleJob({rule: '*/1 * * * * *', tz}, () => {
    log.debug('minute job run')
    dailyDashboardReset()

    handleExpireStat()
})

minJob.on('error', (err) => {
    log.error('minute job error: ', err)
})
