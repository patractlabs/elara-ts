import Mom from 'moment'
import { getAppLogger } from '@elara/lib'
import { StartT, DurationT, MomUnit } from './interface'

const log = getAppLogger('util')

export function lastTime(unit: MomUnit, off: number = 1): number[] {
    const last = Mom().subtract(off, `${unit}s` as DurationT)
    const start = last.startOf(unit as StartT).clone()
    const end = last.endOf(unit as StartT)
    log.debug(`last start-end of ${off} ${unit}: `, start, end)
    return [start.valueOf(), end.valueOf()]
}

export function todayStamp(): number {
    const today = Mom().startOf('day')
    log.debug('today is: ', today)
    return today.valueOf()
}