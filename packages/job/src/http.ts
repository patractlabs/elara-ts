import Http from 'http'
import { Code, Err, getAppLogger, Ok, PResultT, PVoidT } from '@elara/lib'
import Conf from '../config'
import { ProAttr, StatT, UserAttr } from './interface'

const conf = Conf.getApiServer()
const log = getAppLogger('http')

const baseUrl = `http://${conf.host}:${conf.port}/api`

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
                    // 'Accept': 'application/json',
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

    static async getUserList(): Promise<UserAttr[]> {
        try {
            const re = JSON.parse(await this.get(baseUrl + '/user/list'))
            if (re.code != Code.Ok) {
                log.error('fetch user list error: %o', re.msg)
                return []
            }
            return re.data as UserAttr[]
        } catch (err) {
            log.error(`fetch user list error: %o`, err)
            return []
        }
    }

    static async getUserWithLimit(userId: number): PResultT<UserAttr> {
        try {
            const re = JSON.parse(await this.post(baseUrl + '/user/detail/withlimit', {
                userId
            }))
            if (re.code != Code.Ok) {
                log.error('get user with limit error: %o', re.msg)
                return Err(re.msg)
            }
            return Ok(re.data as UserAttr)
        } catch (err) {
            log.error(`get user limit resource error: %o`, err)
            return Err('get error')
        }
    }

    static async getProjectList(userId: number): Promise<ProAttr[]> {
        try {
            const re = JSON.parse(await this.post(baseUrl + '/project/list', {
                userId
            }))
            if (re.code != Code.Ok) {
                log.error('fetch project list error: %o', re.msg)
                return []
            }
            return re.data as ProAttr[]
        } catch (err) {
            log.error(`fetch project list error: %o`, err)
            return []
        }
    }

    static async updateUserStatus(githubId: string, status: string): PVoidT {
        try {
            const re = await this.post(baseUrl + '/user/update/status', {
                githubId,
                status
            })
            const res = JSON.parse(re)
            if (res.code !== Code.Ok) {
                log.error(`update github user[${githubId}]}] status[${status}] error: %o`, res.msg)
            }
        } catch (err) {
            log.error(`update user[${githubId}] status[${status}] error: %o`, err)
        }
    }

    static async updateProjectStatus(id: number, status: string) {
        try {
            const re = await this.post(baseUrl + '/project/update/status', {
                id,
                status
            })
            const res = JSON.parse(re)
            if (res.code !== Code.Ok) {
                log.error(`update project[${id}]}] status[${status}] error: %o`, res.msg)
            }
        } catch (err) {
            log.error(`update project[${id}] status[${status}] error: %o`, err)
        }
    }

    static async getProject(chain: string, pid: string): PResultT<ProAttr> {
        try {
            const re = JSON.parse(await this.post(baseUrl + '/project/detail/chainpid', {
                chain,
                pid
            }))
            if (re.code !== Code.Ok) {
                log.error('get project detail error: %o', re.msg)
                return Err(re.msg)
            }
            return Ok(re.data)
        } catch (err) {
            log.error(`get ${chain} project[${pid}] detail error: %o`, err)
            return Err('get error')
        }
    }

    static async getUserDailyStatistic(userId: number): PResultT<StatT> {
        try {
            const re = JSON.parse(await this.post(baseUrl + '/user/detail/statistic', {
                userId
            }))
            if (re.code !== Code.Ok) {
                log.error('get user daily statistic error: %o', re.msg)
                return Err(re.msg)
            }
            return Ok(re.data)
        } catch (err) {
            log.error(`get user[${userId}] daily statistic error: %o`, err)
            return Err('get error')
        }
    }
}