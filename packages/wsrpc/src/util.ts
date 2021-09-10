import { performance } from 'perf_hooks'
import { Ok, Err, PResultT } from '@elara/lib'
import Chain from './chain'
import { ChainPidT } from './interface'

class Util {
    static reqFastStr(obj: JSON): string {
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

    static respFastStr(obj: JSON): string {
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

    static async urlParse(url: string): PResultT<ChainPidT> {
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

    static traceStart(): number {
        return performance.now()
    }

    static traceEnd(start: number): string {
        return (performance.now() - start).toFixed(0) + 'ms'
    }

    static traceDelay(start: number): number {
        return Math.floor(performance.now() - start)
    }

    static globalStat(): string {
        return ''
        // return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    }

    static strBytes(str: string): number {
        return Buffer.byteLength(str, 'utf8')
    }

    static async sleep(sec: number) {
        return new Promise((resolve, _reject) => {
            setTimeout(() => {
                resolve(' enough sleep~')
            }, sec)
        })
    }
}

export default Util