import { Subscriber,DBT, unexpectListener, dotenvInit, getAppLogger } from '@elara/lib'
import { handleStat } from './src/statistic'
import Service from './src/service'
import Conf from './config'

dotenvInit()

const redis = Conf.getRedis()
const log = getAppLogger('app')
const dayRule = '* 0 * * *'

const subws = new Subscriber(DBT.Pubsub, { host: redis.host })
const subhttp = new Subscriber(DBT.Pubsub, { host: redis.host });

(function main() {
    Service.init(dayRule)
    subws.subscribe('statistic-ws', handleStat, 0)
    subhttp.subscribe('statistic-http', handleStat, 0)
    log.info('Job server run: ', process.env.NODE_ENV)
})()

unexpectListener()
