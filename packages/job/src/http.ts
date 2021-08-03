import Http from 'http'
import { getAppLogger } from '@elara/lib'

const log = getAppLogger('http')

export default class HttpUtil {

    static async get(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let data = ''
            const req = Http.get(url, {
                auth: process.env.AUTH
            }, (res: Http.IncomingMessage) => {
                res.on('data', (chunk) => {
                    data += chunk
                })
                res.on('end', () => {
                    log.debug('http get response: %o', data)
                    resolve(data)
                })
            })
            req.on('error', (err: Error) => {
                log.error('http get error: %o', err)
                reject({ code: 500, msg: err, data: false })
            })
            req.end()
        })
    }

    static async post(url: string, body: any): Promise<any> {
        return new Promise((resolve, reject) => {
            let data = ''
            const req = Http.request(url, {
                method: 'POST',
                auth: process.env.AUTH,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            }, (res: Http.IncomingMessage) => {
                res.on('data', (chunk) => {
                    data += chunk
                })
                res.on('end', () => {
                    log.debug('http post response: %o', data)
                    resolve(data)
                })
            })
            req.on('error', (err: Error) => {
                log.error('http post error: %o', err)
                reject({ code: 500, msg: err, data: false })
            })
            req.write(JSON.stringify(body))
            req.end()
        })
    }
}