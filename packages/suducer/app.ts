import { getAppLogger, dotenvInit } from '../lib'
import Chain from './src/chain'
import Suducer from './src/suducer'

dotenvInit()
const env = process.env.NODE_ENV
const out = env === 'dev'
const log = getAppLogger('app', out)

const errorTypes = ['unhandledRejection', 'uncaughtException']
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

errorTypes.map(type => {
    process.on(type, async (err) => {
        try {
            log.error(`process on ${type}: `, err)
            process.exit(1)
        } catch (_) {
            log.error(`process catch ${type}: `, err)
            process.exit(2)
        }
    })
})

signalTraps.map((type: any) => {
    process.once(type, async (err) => {
        try {
            log.error(`process on signal event: ${type}: `, err)
        } finally {
            process.kill(process.pid, type)
        }
    })
})

const run = async () => {
    log.info(`Suducer server run, env=${env}`)
    await Chain.init()
}
run()