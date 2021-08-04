import { getAppLogger } from "./log"

const log = getAppLogger('Unexpect')

const errorTypes = ['unhandledRejection', 'uncaughtException']
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

export function unexpectListener(): void {
    log.debug('unexcept listener start')
    errorTypes.map(type => {
        process.on(type, async (err) => {
            try {
                log.error(`process on ${type}: %o`, err)
                process.exit(1)
            } catch (_) {
                log.error(`process catch ${type}: %o`, err)
                process.exit(2)
            }
        })
    })
    
    signalTraps.map((type: any) => {
        process.once(type, async (err) => {
            try {
                log.error(`process on signal event: ${type}: %o`, err)
            } finally {
                process.kill(process.pid, type)
            }
        })
    })
}