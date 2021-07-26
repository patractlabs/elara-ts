import { Subscriber, getAppLogger, DBT } from '@elara/lib'
import Conf from '../config'
const log = getAppLogger('statistic')

const redis = Conf.getRedis()

const subws = new Subscriber(DBT.Pubsub, { host: redis.host })
const subhttp = new Subscriber(DBT.Pubsub, { host: redis.host })

function handleWsStat(stream: string[]): void {
    const stat = JSON.parse(stream[1][1])
    log.debug('get ws statistic: ', stream, stat.code, stat)
}

function handleHttpStat(stream: string[]): void {
    const stat = JSON.parse(stream[1][1])
    log.debug('get http statistic: ', stream, stat.code, stat)
}

export function run() {
    subws.subscribe('statistic-ws', handleWsStat, 0)
    subhttp.subscribe('statistic-http', handleHttpStat, 0)

}