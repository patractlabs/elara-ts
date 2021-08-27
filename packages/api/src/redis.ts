import { Redis, DBT, getAppLogger } from "@elara/lib"
import Conf from '../config'

const log = getAppLogger('redis')
const rconf = Conf.getRedis()

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

const Stat = new Redis(DBT.Stat, {
    host: rconf.host, port: rconf.port, options: {
        password: rconf.password
    }
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

Stat.onConnect(() => {
    log.info('stat redis connection open')
})

Stat.onError((err) => {
    log.error('stat redis connection error: %o', err)
})

export const ProRd = Pro.getClient()
export const UserRd = User.getClient()
export const StatRd = User.getClient()