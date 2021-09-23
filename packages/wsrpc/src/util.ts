import { performance } from 'perf_hooks'
import { Ok, Err, PResultT, ResultT } from '@elara/lib'
import Chain from './chain'
import { ChainPidT, ReqDataT } from './interface'
import { UnsafeMethods } from './matcher/topic'

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
        const chain = par[1].toLowerCase()  // maybe empty
        let pid = '00000000000000000000000000000000'    // for public
        // chain check
        if (!Chain.hasChain(chain)) {
            return Err(`invalid chain[${chain}]`)
        }
        if (par.length === 3) {
            if (par[2].length === 32) {
                pid = par[2]
            } else {
                return Err(`Invalid request path: ${url}`)
            }
        }
        // public url without pid, default 0s
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

    static rpcCheck(data: string): ResultT<ReqDataT> {
        try {
            let dat = JSON.parse(data) as ReqDataT
            if (!dat.id || !dat.jsonrpc || !dat.method || !dat.params) {
                return Err('invalid request must be JSON {"id": string, "jsonrpc": "2.0", "method": "your method", "params": []}')
            }

            if (UnsafeMethods.has(dat.method)) {
                return Err(`Forbiden Access!`)
            }
            return Ok(dat)
        } catch (err: any) {
            return Err(err)
        }
    }
}

export default Util