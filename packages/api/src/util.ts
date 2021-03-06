import Mom from 'moment'
import { getAppLogger, Msg } from '@elara/lib'
import { StartT, DurationT, MomUnit } from './interface'

const log = getAppLogger('util')

export function lastTime(unit: MomUnit, off: number = 1): number[] {
    const last = Mom().utcOffset('+08:00', false).subtract(off, `${unit}s` as DurationT)
    const start = last.startOf(unit as StartT).clone()
    const end = last.endOf(unit as StartT)
    log.debug(`last start-end of ${off} ${unit}: ${start}-${end}`)
    return [start.valueOf(), end.valueOf()]
}

export function todayStamp(): number {
    const today = Mom().utcOffset('+08:00', false).startOf('day')
    log.debug('today is: %o', today)
    return today.valueOf()
}

export function errMsg(err: any, msg: string): Msg {
    log.debug('error msg: %o', err)
    if (err.errors) {
        return err.errors[0].message ?? msg
    } else {
        return err.original.detail ?? msg
    }
}