import crypto from 'crypto'
import { now } from '../lib/date'
import { setConfig } from '../../config'
import { getAppLogger } from 'lib'
// import redis from 'lib/utils/redis'
import { IDT } from 'lib'
import { Err, isErr, isOk, Ok, Result } from '../lib/result'
import Redis from 'ioredis'

const redis = new Redis({
    port: 6379,
    host: '127.0.0.1',
    db: 1
})

redis.on('connect', () => {
    log.info('Redis connect successfuly')
})
redis.on('error', (e) => {
    log.error('Redis error: ', e)
})

const config = setConfig()
const log = getAppLogger('stat-pro', true)

enum Status {
    Active = 'Active',
    Stop = 'Stop',
    Abnormal = 'Abnormnal'
}

/// 
interface Project {
    id: IDT            // project id 
    status: Status      
    chain: string       // chain name
    name: string        // project name
    uid: IDT            // user id
    secret: string
    createTime: string | number
    lastTime: string | number
    allowList: boolean   // white list
    [key: string]: any
}

type PResult = Promise<Result<any, string>>
type SNU = string | null | undefined
type INU = SNU | number

const isEmpty = (str: SNU): boolean => {
    if (str === '' || str === null || str === undefined) {
        return true
    }
    return false
}

/**
 * 
 * @param chain chain name
 * @param id pid or uid
 */
const isInValidKey = (chain: SNU, id: INU): boolean => {
    if (isEmpty(chain) || isEmpty(id?.toString())) {
        log.warn('Empty chain or id')
        return true
    }
    return false
}

namespace KEY {
    const P = 'Project'

    export const ProjectNumKey = `${P}_Num`

    export const projectKey = (chain?: string, pid?: IDT) => {
        let com = `H_${P}_`
        let CHAIN = '*_'
        let PID = `${pid}`
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}_`
        }
        if (isEmpty(pid?.toString())) {
           PID = '*'
        }
        // if chain is empty and pid not, would be get only one
        let key = `${com}${CHAIN}${PID}`
        // log.info('Project key: ', key)
        return key
    }

    export const projectListKey = (uid?: IDT, chain?: string): string => {
        let com = `Z_${P}_list_`
        let CHAIN = '*'
        let UID = `${uid}_`
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}`
        }
        if (isEmpty(uid?.toString())) {
            UID = '*_'
        }
        let key = `${com}${UID}${CHAIN}`
        // log.info('Project list key: ', key)
        return key
    }
}

// depends on the db strategy
const dumpProject = async (project: Project): PResult => {
    // TODO error handle, transaction 
    // hset project item
    if (isInValidKey(project.chain, project.id)) {
        return Err('Empty chain or pid')
    }
    let key = KEY.projectKey(project.chain, project.id)
    try {
        await redis.hmset(key, project)

        // incr project num
        let cnt = await redis.incr(KEY.ProjectNumKey)
    
        // zadd list
        key  = KEY.projectListKey(project.uid, project.chain)
        await redis.zadd(key, cnt, project.id)
        
        
    } catch (e) {
        log.error('Dump project error: ', e)
        return Err(e)
    }
    
    return Ok('ok')
}

namespace Project {

    export const create = async (uid: IDT, chain: string, name: string): PResult => {
        log.info('Into projec create!', uid, chain, name)
            
        let id = crypto.randomBytes(16).toString('hex');
        let status = Status.Active;
        let secret = crypto.randomBytes(16).toString('hex');
        const timestamp = now()
        let createTime = timestamp;
        let lastTime = timestamp;
        log.info('timestamp: ', timestamp)
    
        let project = {
            id,
            name,
            uid,
            chain,
            secret,
            status,
            createTime,
            lastTime,
            allowList: false
        }
        log.warn('Project to create: ', project)
        let re = await dumpProject(project)
        if (isOk(re)) {
            return Ok(project)
        }
        return re
    }

    export const isExist = async(uid:IDT, chain: string, name: string): Promise<boolean> => {
        log.info('Info project exist check: ', uid, chain, name)
        if (isInValidKey(chain, uid)) {
            return true 
        }
        try {
            const key = KEY.projectListKey(uid, chain)
            let pidLis = await redis.zrange(key, 0, -1)
            for (let pid of pidLis) {
                let pkey = KEY.projectKey(chain, pid)
                let pname = await redis.hget(pkey, 'name')
                if (pname === name) {
                    log.warn('duplicate project name')
                    return true
                }
            }
        } catch (e) {
            log.error('Project exist check error: ', e)
            return true
        }
        return false
    }

    export const isActive = (project: Project): boolean => {
        return project.status === Status.Active
    }

    const setStatus = async (chain: string, pid: IDT, status: Status): PResult => {
        if (isInValidKey(chain, pid)) {
            return Err('Empty chain or pid')
        }
        const key = KEY.projectKey(chain, pid)
        try {
            redis.hset(key, 'status', status)
            return Ok({status})
        } catch (e) {
            log.error('Set project status error: ', e)
            return Err(e)
        }
    }
    
    export const switchStatus = async (chain: string, pid: IDT): PResult => {
        if (isInValidKey(chain, pid)) {
            return Err('Empty chain or pid')
        }
        const key = KEY.projectKey(chain, pid)
        try {
            const stat = await redis.hget(key, 'status')
            let status = Status.Stop
            if (stat === Status.Active) {
                redis.hset(key, 'status', Status.Stop)
            } else if (stat === Status.Stop) {
                redis.hset(key, 'status', Status.Active)
                status = Status.Active
            } else {
                log.error('Project status error');
                return Err('Status error')
            }
            return Ok({ status })
        } catch (e) {
            log.error('Switch project status error: ', e)
            return Err(e)
        }
    }

    export const detail = async (chain: string, pid: IDT): PResult => {
        // TODO: the way to quick wrap
        const key = KEY.projectKey(chain, pid)
        let pro
        try {
            let lis = [key]
            if (isEmpty(chain)) {
                // for the project key has chain field H_Project_[CHAIN]_[PID]
                lis = await redis.keys(key)
                if (lis.length < 1) {
                    return Err('No this project or chain exist')
                }
            }
           
            for (let p of lis) {
                pro = await redis.hgetall(p)
                // log.warn('Project detail: ', pro)
                if (isEmpty(pro?.id)) {
                    return Err('No this project or chain exist')
                }
            }
        } catch (e) {
            log.error('Get project detail error: ', e)
            return Err(e)
        }
        return Ok({
            id: pro.id,
            name: pro.name,
            uid: pro.uid,
            chain: pro.chain,
            status: pro.status as Status,
            secret: pro.secret,
            createTime: pro.createTime,
            lastTime: pro.lastTime,
            allowList: pro.allowList === 'false' ? false : true
        })
    }

    // project number in every chain of user
    export const projectNumOfAllChain = async (uid: IDT): PResult => {
        const key = KEY.projectListKey(uid)
        let re = {}
        try {
            let chains = await redis.keys(key)
            for (let k of chains) {
                let chs = k.split('_')
                let chain_name = chs[chs.length - 1]
                let cnt = await redis.zcard(k)
                // log.warn('chain: ', c, chain_name, cnt)
                re[chain_name] = cnt
            }
        } catch (e) {
            log.error('Get project count error: ', e)
            return Err(e)
        }
        return Ok(re)
    }

    /**
     * 
     * @param uid 
     * @param chain if not null, return the project in this chain
     *              else all the projects
     * @returns 
     */
    export const projectList = async (uid: IDT, chain: string): PResult => {
        
        try {
            const key = KEY.projectListKey(uid, chain)
            let setLis
            if (isInValidKey(chain, uid)) {
                setLis = await redis.keys(key)
            } else {
                setLis = [key]
            }
            let lis: any[] = []
            for (let s of setLis) {
                let pidLis = await redis.zrange(s, 0, -1)
               
                for (let p of pidLis) {
                    let pro = await detail(chain, p)
                    if (isErr(pro)) {
                        log.error('Get project detail error: ', pro.value)
                        return pro
                    }
                    lis.push(pro.value)
                }
            }
            return Ok(lis)
        } catch (e) {
            log.error('Get project list error: ', e)
            return Err(e)
        }
    }
}

export = Project