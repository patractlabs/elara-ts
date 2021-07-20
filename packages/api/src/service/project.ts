import { IDT, getAppLogger, randomId,Err, isErr, Ok, PResultT, KEYS, PVoidT } from '@elara/lib'
import { now } from '../lib/date'
import { projRd } from '../dao/redis'

const KEY = KEYS.Project

projRd.on('connect', () => {
    log.info('Redis connect successfuly')
})

projRd.on('error', (e) => {
    log.error('Redis error: ', e)
})

const log = getAppLogger('stat-pro')

export enum ProStatus {
    Active = 'Active',
    Stop = 'Stop',
    Suspend = 'Suspend',
    Delete = 'Delete'
}

/// 
interface Project {
    id: IDT            // project id 
    status: ProStatus
    chain: string       // chain name
    name: string        // project name
    uid: string            // user id
    secret: string
    reqSecLimit: number,
    bwDayLimit: number,
    createTime: string | number
    updateTime: string | number
    // [key: string]: any
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
        log.error('Empty chain or id')
        return true
    }
    return false
}

// depends on the db strategy
const dumpProject = async (project: Project): PResultT<"OK"> => {
    const { id, chain, name, uid, createTime } = project

    if (isInValidKey(chain, id)) {
        return Err('Empty chain or pid')
    }
    const timestr = createTime.toString()
    try {
        await Promise.all([
            projRd.hmset(KEY.hProject(chain, id), project as any),
            projRd.zadd(KEY.zProjectList(uid, chain), timestr, id),
            projRd.zadd(KEY.zProjectNames(uid, chain), timestr, name),
            projRd.incr(KEY.projectNum())
        ])
    } catch (e) {
        log.error('Dump project error: ', e)
        return Err(e)
    }
    return Ok("OK")
}

class Project {

    static async create(uid: string, chain: string, name: string, options?: Project): PResultT<Project> {
        log.info('Into projec create!', uid, chain, name, options)
        let reqSecLimit: number = 0
        let bwDayLimit : number = 0
        // const conf = Conf.getLimit()
        if (!options) {
            reqSecLimit = 0
            bwDayLimit = 0
        }

        const timestamp = now()     // now second 

        let project = {
            id: randomId(),
            name,
            uid,
            chain,
            secret: randomId(),
            status: ProStatus.Active,
            createTime: timestamp,
            updateTime: timestamp,
            reqSecLimit,
            bwDayLimit
        }
        log.warn('Project to create: ', project)
        let re = await dumpProject(project)
        if (isErr(re)) {
            return re
        }
        return Ok(project)
    }

    static isActive(project: Project): boolean {
        return project.status === ProStatus.Active
    }

    static async isExist(uid: IDT, chain: string, name: string): Promise<boolean> {
        log.debug('Info project exist check: ', uid, chain, name)
        if (isInValidKey(chain, uid)) { return true }
    
        try {
            const key = KEY.zProjectNames(uid, chain)
            const names = await projRd.zrange(key, 0, -1)
            if (names.includes(name)) {
                log.debug(`duplicate name ${name}`)
                return true
            }
        } catch (e) {
            log.error('Project exist check error: ', e)
            return true
        }
        return false
    }

    static async updateStatus(chain: string, pid: IDT, status: ProStatus): PResultT<ProStatus> {
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

    static async detail(chain: string, pid: IDT): PResultT<Project> {
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
                pro = await projRd.hgetall(p) as any as Project
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
            status: pro.status as ProStatus,
            secret: pro.secret,
            createTime: pro.createTime,
            updateTime: pro.updateTime,
        } as Project)
    }

    // project number in every chain of user
    static async projectNumOfAllChain(uid: IDT): PResultT<any> {
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
    static async projectList(uid: IDT, chain: string): PResultT<Project[]> {

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
                    let pro = await Project.detail(chain, p)
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

    static async changeName(chain: string, pid: string, name: string): Promise<boolean> {
        const key = KEY.hProject(chain, pid)
        const re = await projRd.hset(key, 'name', name)
        return re === 1
    }

    static async delete(chain: string, pid: string) {
        const key = KEY.hProject(chain, pid)

        projRd.hset(key, 'status', ProStatus.Delete)
        // logic delete
    }

    static async updateLimit(chain: string, pid: IDT, reqSecLimit?: number, bwDayLimit?: number): PVoidT {
        const key = KEY.hProject(chain, pid)
        log.debug(`update ${chain} project[${pid}]: `)
        if (reqSecLimit) {
            projRd.hset(key, 'reqSecLimit', reqSecLimit)
        }
        if (bwDayLimit) {
            projRd.hset(key, 'bwDayLimit', bwDayLimit)
        }
    }
}

export default Project