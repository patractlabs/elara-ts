import { Redis } from 'lib/utils'
import { getAppLogger } from 'lib'

const log = getAppLogger('redis')

// TODO redis pool

export const chainRd = new Redis({db: 3})

// pubsub connection only support pub/sub relate command
export const chainPSub = new Redis()

export const cacheRd = new Redis({db: 4})


chainRd.on('connect', (e) => {
    log.info('Chain redis connected successfully')
})

chainRd.on('error', (e) => {
    log.error('Chain redis error: ', e)
})