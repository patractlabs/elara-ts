import { Subscriber, DBT, unexpectListener, dotenvInit, getAppLogger } from '@elara/lib'
import Service from './src/service'
import Conf from './config'

dotenvInit()

const redis = Conf.getRedis()
const log = getAppLogger('app')

const subws = new Subscriber(DBT.Pubsub, {
    host: redis.host, port: redis.port, options: {
        password: redis.password
    }
})

const subhttp = new Subscriber(DBT.Pubsub, {
    host: redis.host, port: redis.port, options: {
        password: redis.password
    }
});

(function main() {
    unexpectListener()

    Service.init()
    subws.subscribe('statistic-ws', Service.handleStat, 0)
    subhttp.subscribe('statistic-http', Service.handleStat, 0)
    log.info('Job server run: %o', process.env.NODE_ENV)
})()
