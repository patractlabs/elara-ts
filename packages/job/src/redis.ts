import { Redis, DBT, getAppLogger } from "@elara/lib"
import Conf from '../config'

const log = getAppLogger('redis')
const rconf = Conf.getRedis()

const Stt = new Redis(DBT.Stat, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const Pro = new Redis(DBT.Project, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

const User = new Redis(DBT.User, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
})

Stt.onConnect(() => {
    log.info('statistic redis connection open')
})

Stt.onError((err) => {
    log.error('statistic redis connection error: %o', err)
})

Pro.onConnect(() => {
    log.info('project redis connection open')
})

Pro.onError((err) => {
    log.error('project redis connection error: %o', err)
})

User.onConnect(() => {
    log.info('user redis connection open')
})

User.onError((err) => {
    log.error('user redis connection error: %o', err)
})

export const SttRd = Stt.getClient()
export const ProRd = Pro.getClient()
export const UserRd = User.getClient()