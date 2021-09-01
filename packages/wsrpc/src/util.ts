import { performance } from 'perf_hooks'
import { Ok, Err, PResultT } from '@elara/lib'
import Chain from './chain'
import { ChainPidT } from './interface'

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
        const par = url.split('/')
        const chain = par[1].toLowerCase()
        let pid = '00000000000000000000000000000000'    // for public
        // chain check
        if (!Chain.hasChain(chain)) {
            // return Ok({ chain: 'polkadot', pid})    // for local test
            return Err(`invalid chain[${chain}]`)
        }
        if (par.length === 3) {
            if (par[2].length === 32) {
                pid = par[2]
            } else {
                return Err(`Invalid request path: ${url}`)
            }
        }
        return Ok({ chain, pid })
    }

    export function traceStart(): number {
        return performance.now()
    }

    export function traceEnd(start: number): string {
        return (performance.now() - start).toFixed(0) + 'ms'
    }

    export function traceDelay(start: number): number {
        return Math.floor(performance.now() - start)
    }

    export function globalStat(): string {
        return ''
        // return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    }

    export function strBytes(str: string): number {
        return Buffer.byteLength(str, 'utf8')
    }

    export async function sleep(sec: number) {
        return new Promise((resolve, _reject) => {
            setTimeout(() => {
                resolve(' enough sleep~')
            }, sec)
        })
    }
}

export default Util