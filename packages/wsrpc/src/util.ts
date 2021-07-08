import { performance } from 'perf_hooks'
import Http from 'http'
import { Ok, Err, getAppLogger, PResultT, PVoidT } from 'lib'
import Chain from './chain'
import { ChainPidT } from './interface'

const log = getAppLogger('util', true)
const G = Chain.G

const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()

namespace Util {
    export function reqFastStr(obj: JSON): string {
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

    export function respFastStr(obj: JSON): string {
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

    export async function urlParse(url: string): PResultT<ChainPidT> {
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
        log.debug(`url parse time: ${time}`)
        return Err(`Invalid request path`)
    }

    export function traceStart(): number {
        return performance.now()
    }

    export function traceEnd(start: number): string {
        return (performance.now() - start).toFixed(0) + 'ms'
    }

    export function globalStat(): string {
        return ''
        // return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    }
}

export namespace Response {
    const end = async (res: Http.ServerResponse, chunk: any, code: number, md5?: string): PVoidT => {
        res.writeHead(code, { 'Content-Type': 'text/plain', 'Trailer': 'Content-MD5' })
        res.addTrailers({ 'Content-MD5': md5 || '7878' })
        res.write(chunk)
        res.end()
    }

    export async function Ok(res: Http.ServerResponse, data: any): PVoidT {
        end(res, data, 200)
    }

    export async function Fail(res: Http.ServerResponse, data: any, code: number): PVoidT {
        end(res, data, code)
    }
}

export default Util