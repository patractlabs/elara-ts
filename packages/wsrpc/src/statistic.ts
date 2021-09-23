import Http from 'http'
import { PVoidT, DBT, Producer } from "@elara/lib"
import Conf from '../config'
import { Statistics } from './interface'
import Util from './util'

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

    static build(proto: string, method: string, header: Http.IncomingHttpHeaders): Statistics {
        let ip = header.host
        if (header['x-forwarded-for']) {
            ip = header['x-forwarded-for'] as string
        }
        const head = { origin: header.origin ?? '', agent: header['user-agent'] ?? '', ip }
        return {
            proto,
            method,
            header: head,
            start: Util.traceStart(),
            reqtime: Date.now()
        } as Statistics
    }
}