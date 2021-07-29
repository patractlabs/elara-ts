import { lastTime, startStamp, tillTime, todayStamp } from '../src/util'

const log = console

log.info('last 24 hour: ', tillTime('hour', 24), lastTime('hour', 24))
log.info('today stamp: ', todayStamp())
log.info('expire day: ', startStamp('day', 30))