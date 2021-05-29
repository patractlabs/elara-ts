import Redis, { RedisOptions } from 'ioredis'
import { getAppLogger } from './log'

const log = getAppLogger('Redis', true)

namespace Rd {
    export enum DBT {
        Account = 0,
        Project = 1,
        Stat    = 2,
        Chain   = 3,
        Cache   = 4,
    }

    type RdT = Redis.Redis

    interface RArgT {
        port?: number,
        host?: string,
        options?: RedisOptions
    }

    interface RClientT {
        client: RdT,
        db: DBT
    }

    export const newClient = (db: DBT, arg?: RArgT): RClientT => {
        const options = {
            ...arg?.options,
            db
        }
        return {
            client: new Redis(arg?.port, arg?.host, options),
            db
        }
    }

    export const onConnect = (Rd: RClientT, cb?: () => void) => {
        Rd.client.once('connect', () => {
            log.info(`Redis-${Rd.db} connect successfully.`)
            cb && cb()
        })
    }

    export const onError = (Rd: RClientT, cb?: (err: any) => void) => {
        Rd.client.on('error', (err) => {
            log.error(`Redis-${Rd.db} error: `, err)
            cb && cb(err)
        })
    }

    export const onMsg = (Rd: RClientT, cb?: (topic: string, data: any) => void) => {
        Rd.client.on('message', (topic, data) => {
            log.info(`Redis-${Rd.db} message event Topic[${topic}]: `, data)
            cb && cb(topic, data)
        })
    }

    export const onPMsg = (Rd: RClientT, cb?: (topic: string, data: any, pat?: string) => void) => {
        Rd.client.on('pmessage', (pat, topic, data) => {
            log.info(`Redis-${Rd.db} pattern message event Pat[${pat}] Topic[${topic}]: `, data)
            cb && cb(topic, data, pat)
        })
    }
}

export = Rd