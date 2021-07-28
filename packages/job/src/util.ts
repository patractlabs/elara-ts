import Mom from 'moment'
import { getAppLogger } from '@elara/lib'
import { StartT, DurationT } from './interface'

const log = getAppLogger('util')

export function lastTime(time: string, unit: number = 1): number[] {
    const last = Mom().subtract(unit, `${time}s` as DurationT)
    const start = last.startOf(time as StartT).clone()
    const end = last.endOf(time as StartT)
    log.debug(`last start-end of ${unit} ${time}: `, start, end)
    return [start.valueOf(), end.valueOf()]
}

export function lastTimes(time: string, unit: number = 1): number[] {
    const cur = Mom()
    const last = cur.clone().subtract(unit, `${time}s` as DurationT)
    const start = last.startOf(time as StartT).clone()
    const end = cur.startOf(time as StartT)
    log.debug(`last start-end of ${unit} ${time}s: `, start, end, start.valueOf(), end.valueOf())
    return [start.valueOf(), end.valueOf()]
}