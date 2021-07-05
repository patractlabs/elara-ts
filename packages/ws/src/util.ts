import { performance } from 'perf_hooks'
import { Ok, Err, PResultT, getAppLogger } from '../../lib'
import { G } from './chain'

const log = getAppLogger('util', true)

const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()

namespace Util {
    export const urlParse = async (url: string): PResultT => {
        const start = traceStart()
        if (UrlReg.test(url)) {
            const parse = UrlReg.exec(url)
            const chain = parse![1].toLowerCase()
            // chain check
            if (!G.hasChain(chain)) { 
                return Err(`invalid chain[${chain}]`)
            }
            // pid check
            // TODO
            return Ok({
                chain,
                pid: parse![2]
            })
        }
        const time = traceEnd(start)
        log.info(`url parse time: ${time}`)
        return Err(`Invalid request path`)
    }

    export const traceStart = (): number => {
        return performance.now()
    }

    export const traceEnd = (start: number): string => {
        return (performance.now() - start).toFixed(0) + 'ms'

    }

    export const globalStat = () => {
        // return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    }
}

export default Util