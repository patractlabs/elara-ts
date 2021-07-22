import Http from 'http'
import Stream from 'stream'
import { PVoidT } from '@elara/lib'
import { Statistics } from './interface'
import Util from './util'

const log = console

export default class Response {
    private static async end(res: Http.ServerResponse, chunk: any, code: number): PVoidT {
        res.writeHead(code, { 'Content-Type': 'text/plain'})
        res.write(chunk)
        res.end()
    }

    static async Ok(res: Http.ServerResponse, data: string, stat: Statistics): PVoidT {
        stat.code = 200
        stat.delay = Util.traceDelay(stat.start)
        if (stat.delay > 10) {
            stat.timeout = true
        }
        stat.bw = Util.strBytes(data)
        log.debug('response statistics result: ', stat)
        const rf = new Stream.PassThrough()
        rf.end(data)
        rf.pipe(res)
        // Response.end(res, data, 200)
    }

    static async Fail(res: Http.ServerResponse, data: string, code: number, stat: Statistics): PVoidT {
        log.debug('response statistics result: ', stat)
        stat.code = code
        stat.delay = Util.traceDelay(stat.start)
        Response.end(res, data, code)
    }
}