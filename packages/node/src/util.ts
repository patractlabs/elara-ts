import { getAppLogger, Option, Some, None } from 'lib'
import G from './global'
import FastStr from 'fast-json-stringify'
import { ChainPidT } from './interface'

const log = getAppLogger('util', true)

// /chain/pid
const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()


namespace Util {

    export const reqFastStr = FastStr({
        title: 'req schema',
        type: 'object',
        properties: {
            id: { type: 'string' },
            jsonrpc: { type: 'string', default: '2.0'},
            method: { type: 'string' },
            params: { type: 'array', default: [] }
        }
    })

    export const respFastStr = FastStr({
        title: 'resp schema',
        type: 'object',
        properties: {
            id: { type: 'string' },
            jsonrpc: { type: 'string', default: '2.0'},
            method: { type: 'string' },
            // params: { type: 'object', properties: {
            //     result: {
            //         type: 'object'
            //     },
            //     subscription: { type: 'string' }
            // } },
            result: { type: 'string' },
            error: { type: 'object', properties: {
                code: { type: 'number' },
                message: { type: 'string' }
            }}
        }
    })

    export const urlParse = (url: string): Option<ChainPidT> => {
        if (UrlReg.test(url)) {
            const parse = UrlReg.exec(url)
            return Some({
                chain: parse![1].toLowerCase(),
                pid: parse![2]
            })
        }
        log.error('Invalid url path: ', url)
        return None
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
        log.warn('Memory usage: ', {
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

    export const logGlobalStat = () => {
        log.warn('global stat: ', {
            suber: G.suberCnt(),
            puber: G.puberCnt(),
            topic: G.topicCnt(),
            subMap: G.subMapCnt(),
            reqMap: G.reqMapCnt(),
        })
    }
}

export default Util