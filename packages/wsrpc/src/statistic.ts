import { PVoidT, DBT } from "@elara/lib"
import { Producer } from '@elara/lib'
import Conf from '../config'
import { Statistics } from './interface'

const redis = Conf.getRedis()

const wspro = new Producer({
    db: DBT.Pubsub, arg: {
        host: redis.host, port: redis.port, options: {
            password: redis.password
        }
    }
})

const httppro = new Producer({
    db: DBT.Pubsub, arg: {
        host: redis.host, port: redis.port, options: {
            password: redis.password
        }
    }
})

export class Stat {
    static async publish(stat: Statistics): PVoidT {
        if (stat.proto === 'ws') {
            wspro.publish(`statistic-ws`, ['result', JSON.stringify(stat)], 10)
        } else {
            httppro.publish(`statistic-http`, ['result', JSON.stringify(stat)], 10)
        }
    }
}