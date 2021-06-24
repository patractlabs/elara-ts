import { getAppLogger, Ok, PResultT, Err } from 'lib'
import { performance } from 'perf_hooks'
import G from './global'
// import FastStr from 'fast-json-stringify'

const log = getAppLogger('util', true)
// /chain/pid
const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()


namespace Util {

    export const reqFastStr = 
    (obj:any) => {
        return JSON.stringify(obj)
    }
    // FastStr({
    //     title: 'req schema',
    //     type: 'object',
    //     properties: {
    //         id: { type: 'string' },
    //         jsonrpc: { type: 'string', default: '2.0'},
    //         method: { type: 'string' },
    //         params: { type: 'array', default: [] }
    //     }
    // })

    export const respFastStr = 
    (obj:any) => {
        return JSON.stringify(obj)
    }
    // FastStr({
    //     title: 'resp schema',
    //     type: 'object',
    //     properties: {
    //         id: { type: 'string' },
    //         jsonrpc: { type: 'string', default: '2.0'},
    //         method: { type: 'string' },
    //         result: { type: 'string' },
    //         error: { type: 'object', properties: {
    //             code: { type: 'number' },
    //             message: { type: 'string' }
    //         }}
    //     }
    // })

    export const urlParse = async (url: string): PResultT => {
        const start = traceStart()
        if (UrlReg.test(url)) {
            const parse = UrlReg.exec(url)
            const chain = parse![1].toLowerCase()
            // chain check
            if (!G.getChains().has(chain)) { 
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

    export const ldel = (lis: any[], value: any) => {
        return lis.filter((val) => {
            return val !== value
        })
    }

    export const logMemory = () => {
        const mem = process.memoryUsage()
        const format = (bytes: number) => {
            return (bytes / 1024 / 1024).toFixed(2) + 'MB'
        }
        log.info('Memory usage: ', {
            rss: format(mem.rss),
            heapTotal: format(mem.heapTotal),
            heapUsed: format(mem.heapUsed),
            external: format(mem.external),
            arrbuff: format(mem.arrayBuffers)
        })
    }

    export const sleeps = async (s: number) => {
        return new Promise(resolve=>setTimeout(resolve, s * 1000))
    }

    export const globalStat = () => {
        return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    }

    export const logDebugResp = (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => {
            data += chunk
        })
        res.on('end', () => {
            log.info('New rpc response: ', data)
        })
    }

    export const traceStart = (): number => {
        return performance.now()
    }

    export const traceEnd = (start: number): string => {
        return (performance.now() - start).toFixed(0) + 'ms'
    }
}

export default Util