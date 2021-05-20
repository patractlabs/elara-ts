import { Redis } from 'lib/utils'
import { getAppLogger } from 'lib'

const log = getAppLogger('redis')

export const chainRd = new Redis({db: 3})

export const cacheRd = new Redis({db: 4})


chainRd.on('connect', (e) => {
    log.info('Chain redis connected successfully')
})

chainRd.on('error', (e) => {
    log.error('Chain redis error: ', e)
})