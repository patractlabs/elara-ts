import  Redis  from 'ioredis'
// const Redis = require('ioredis')
import { getAppLogger } from './log'


const log = getAppLogger('redis', true)
const client = new Redis({
    port: 6379,
    host: '127.0.0.1',
    password: ''
})

client.on("error", (err: any) => {
    log.error('redis error', err)
})

export = client