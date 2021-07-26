import { Redis, DBT, getAppLogger } from "@elara/lib"
import Conf from '../config'

const log = getAppLogger('redis')
const rconf = Conf.getRedis()

const Stt = new Redis(DBT.Stat, {host: rconf.host, port: rconf.port})

Stt.onConnect(() => {
    log.info('statistic redis connection open')
})

Stt.onError((err) => {
    log.error('statistic redis connection error: ', err)
})

export const Rd = Stt.getClient()