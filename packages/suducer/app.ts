import { getAppLogger, dotenvInit, unexpectListener } from '@elara/lib'
import Service from './src/service'

dotenvInit()
const env = process.env.NODE_ENV

const log = getAppLogger('app');

(async () => {
    log.info(`Suducer server run, env = ${env}`)
    unexpectListener()
    Service.up(false)
})()