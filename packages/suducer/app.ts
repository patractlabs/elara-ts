import { getAppLogger, dotenvInit } from 'lib'
import Service from './src/service'
import unexpectListener from 'lib/utils/unexpect'

dotenvInit()
const env = process.env.NODE_ENV

const log = getAppLogger('app');

(async () => {
    log.info(`Suducer server run, env=${env}`)
    unexpectListener()
    Service.up(false)
})()