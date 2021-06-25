import WebSocket from 'ws'
import { getAppLogger } from 'lib'

const log = getAppLogger('test-pusumer', true)

const connect = () => {
    for (let i = 0; i < 10000; i++) {
        const ws = new WebSocket('ws://localhost:90')

        ws.on('open', () => {
            log.info('connectin open')
        })

        ws.on('close', () => {
            log.warn('close')
        })

        ws.on('error', (err) => {
            log.error('client error: ', err)
        })
    }
}

const run = () => {
    connect()
}

run()