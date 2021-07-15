import crypto from 'crypto'
import { now } from '../lib/date'
import { getAppLogger } from 'elara-lib'
import { IDT } from 'elara-lib'
import { Err, isErr, Ok, PResultT } from 'elara-lib'
import { KEYS } from 'elara-lib'
import { projRd } from '../db/redis'

const KEY = KEYS.Project

projRd.on('connect', () => {
    log.info('Redis connect successfuly')
})

projRd.on('error', (e) => {
    log.error('Redis error: ', e)
})

const log = getAppLogger('stat-pro')

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

// depends on the db strategy
const dumpProject = async (project: Project): PResultT<string> => {
    // TODO error handle, transaction 
    // hset project item
    if (isInValidKey(project.chain, project.id)) {
        return Err('Empty chain or pid')
    }
    let key = KEY.hProject(project.chain, project.id)
    try {
        await projRd.hmset(key, project)

        // zadd list
        key  = KEY.zProjectList(project.uid, project.chain)
        await projRd.zadd(key, project.createTime.toString(), project.id)
        
        // incr project num
        await projRd.incr(KEY.projectNum())
    } catch (e) {
        log.error('Dump project error: ', e)
        return Err(e)
    }
    
    return Ok('ok')
}

namespace Project {

    export const create = async (uid: IDT, chain: string, name: string): PResultT<Project> => {
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
        if (isErr(re)) {
            return re
        }
        return Ok(project)
    }

    export const isExist = async(uid:IDT, chain: string, name: string): Promise<boolean> => {
        log.info('Info project exist check: ', uid, chain, name)
        if (isInValidKey(chain, uid)) {
            return true 
        }
        try {
            const key = KEY.zProjectList(uid, chain)
            let pidLis = await projRd.zrange(key, 0, -1)
            for (let pid of pidLis) {
                let pkey = KEY.hProject(chain, pid)
                let pname = await projRd.hget(pkey, 'name')
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

    export const setStatus = async (chain: string, pid: IDT, status: Status): PResultT<Status> => {
        if (isInValidKey(chain, pid)) {
            return Err('Empty chain or pid')
        }
        const key = KEY.hProject(chain, pid)
        try {
            projRd.hset(key, 'status', status)
            return Ok(status)
        } catch (e) {
            log.error('Set project status error: ', e)
            return Err(e)
        }
    }
    
    export const switchStatus = async (chain: string, pid: IDT): PResultT<Status> => {
        if (isInValidKey(chain, pid)) {
            return Err('Empty chain or pid')
        }
        const key = KEY.hProject(chain, pid)
        try {
            const stat = await projRd.hget(key, 'status')
            let status = Status.Stop
            if (stat === Status.Active) {
                projRd.hset(key, 'status', Status.Stop)
            } else if (stat === Status.Stop) {
                projRd.hset(key, 'status', Status.Active)
                status = Status.Active
            } else {
                log.error('Project status error');
                return Err('Status error')
            }
            return Ok(status)
        } catch (e) {
            log.error('Switch project status error: ', e)
            return Err(e)
        }
    }

    export const detail = async (chain: string, pid: IDT): PResultT<Project> => {
        // TODO: the way to quick wrap
        const key = KEY.hProject(chain, pid)
        let pro = {} as Project
        try {
            let lis = [key]
            if (isEmpty(chain)) {
                // for the project key has chain field H_Project_[CHAIN]_[PID]
                lis = await projRd.keys(key)
                if (lis.length < 1) {
                    return Err('No this project or chain exist')
                }
            }
           
            for (let p of lis) {
                pro = await projRd.hgetall(p) as Project
                // log.warn('Project detail: ', pro)
                if (isEmpty(pro.id as SNU)) {
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
            allowList: pro.allowList 
        })
    }

    // project number in every chain of user
    export const projectNumOfAllChain = async (uid: IDT): PResultT<any> => {
        const key = KEY.zProjectList(uid)
        let re: any = {}
        try {
            let chains = await projRd.keys(key)
            for (let k of chains) {
                let chs = k.split('_')
                let chain_name = chs[chs.length - 1]
                let cnt = await projRd.zcard(k)
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
    export const projectList = async (uid: IDT, chain: string): PResultT<Project[]> => {
        
        try {
            const key = KEY.zProjectList(uid, chain)
            let setLis
            if (isInValidKey(chain, uid)) {
                setLis = await projRd.keys(key)
            } else {
                setLis = [key]
            }
            let lis: any[] = []
            for (let s of setLis) {
                let pidLis = await projRd.zrange(s, 0, -1)
               
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