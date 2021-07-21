import { IDT, getAppLogger, randomId,Err, isErr, Ok, PResultT, KEYS, isEmpty, Msg } from '@elara/lib'
import { now } from '../lib/date'
import { projRd } from '../dao/redis'
import Dao from '../dao'
import Conf from '../../config'

const KEY = KEYS.Project

projRd.on('connect', () => {
    log.info('Redis connect successfuly')
})

projRd.on('error', (e) => {
    log.error('Redis error: ', e)
})

const log = getAppLogger('project-service')

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
    chain: string       // chain name, alias network
    team: string,
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

// depends on the db strategy
const dumpProject = async (project: Project): PResultT<"OK"> => {
    const { id, chain, name, uid, createTime } = project

    const timestr = createTime.toString()
    try {
        await Promise.all([
            projRd.hmset(KEY.hProject(chain, id), project as any),
            projRd.zadd(KEY.zProjectList(uid, chain), timestr, id),
            projRd.zadd(KEY.zProjectNames(uid, chain), timestr, name),
            projRd.incr(KEY.projectNum(uid))
        ])
    } catch (e) {
        log.error('Dump project error: ', e)
        return Err(e)
    }
    return Ok("OK")
}

async function chainValid(chain: string): Promise<boolean> {
    const chains = await Dao.getChainList()
    log.debug('valid chains: ', chains)
    if (chains.includes(chain.toLowerCase())) { return true }
    return false
}

async function keyExist(key: string): Promise<boolean> {
    const re = await projRd.exists(key)
    log.debug('key exist result: ', re)
    return re === 1
}

class Project {

    static async create(uid: string, chain: string, name: string, team: string): PResultT<Project> {
        const isOk = await chainValid(chain)
        log.debug('projec create: ', uid, chain, name, isOk)
        if (!isOk) { return Err('invalid chain') }

        const timestamp = now()     // now second 
        const conf = Conf.getLimit()

        let project = {
            id: randomId(),
            name,
            uid,
            chain,
            team,
            secret: randomId(),
            status: ProStatus.Active,
            createTime: timestamp,
            updateTime: timestamp,
            reqSecLimit: conf.reqSecLimit,
            bwDayLimit: conf.bwDayLimit
        }
        let re = await dumpProject(project)
        if (isErr(re)) {
            return re
        }
        return Ok(project)
    }

    static isActive(project: Project): boolean {
        return project.status === ProStatus.Active
    }

    static async isValidProject(chain: string, pid: string): Promise<boolean> {
        const key = KEY.hProject(chain, pid)
        const re = await keyExist(key)
        if (re) { 
            const status = await projRd.hget(key, 'status')
            if (status == ProStatus.Active) {
                return true
            }
        }
        return false
    }

    static async delete(chain: string, uid: string, pid: string): PResultT<void> {
        const key = KEY.hProject(chain, pid)
        const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }
        try {
            const oname = await projRd.hget(key, 'name')

            projRd.zrem(KEY.zProjectNames(uid, chain), oname!)

            projRd.decr(KEY.projectNum(uid))

            projRd.zrem(KEY.zProjectList(uid, chain), pid)

            // rename , keep the delete record
            projRd.rename(key, KEY.hProjectDelete(uid, pid))
        } catch(e) {
            log.error(`delete ${chain} uid[${uid}] project[${pid}] error: ${e}`)
            return Err(e)
        }
        return Ok(void(0))
    }

    static async isExist(uid: IDT, chain: string, name: string): Promise<boolean> {
        log.debug('Info project exist check: ', uid, chain, name)
        try {
            const key = KEY.zProjectNames(uid, chain)
            const names = await projRd.zrange(key, 0, -1)
            log.debug(`project names: `, names, name)
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

    static async detail(chain: string, pid: IDT): PResultT<Project> {
        // TODO: the way to quick wrap
        const key = KEY.hProject(chain, pid)
        const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }

        let pro: Record<string, string>
        try {
            pro = await projRd.hgetall(key)
            // log.warn('Project detail: ', pro)
            if (isEmpty(pro.id as SNU)) {
                return Err('No this project or chain exist')
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

    static async countByUser(uid: IDT): PResultT<number> {
        const re = await projRd.get(KEY.projectNum(uid))
        if (re === null) { return Ok(0)}
        return Ok(parseInt(re))
    }

    // project number in every chain of user
    static async countOfChainList(uid: IDT): PResultT<Record<string, number>> {
        const key = KEY.zProjectList(uid)
        let re: Record<string, number> = {}
        try {
            let chains = await projRd.keys(key)
            for (let k of chains) {
                let chs = k.split('_')
                let chain_name = chs[chs.length - 2]
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

    static async listByChain(uid: IDT, chain: string): PResultT<Project[]> {
        try {
            const key = KEY.zProjectList(uid, chain)
            const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }

            let pLis = await projRd.zrange(key, 0, -1)
            // projRd.exists()
            let res: Project[] = []

            for (let p of pLis) {
                let pro = await Project.detail(chain, p)
                if (isErr(pro)) {
                    log.error('Get project detail error: ', pro.value)
                    return pro
                }
                res.push(pro.value)
            }
            return Ok(res)
        } catch (e) {
            log.error('Get project list error: ', e)
            return Err(e)
        }
    }

    static async changeName(chain: string, uid: IDT, pid: string, name: string): PResultT<void> {
        const key = KEY.hProject(chain, pid)
        const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }

        const nameExist = await Project.isExist(uid, chain, name)
        if (nameExist) {
            log.warn(`update name error: project name ${name} exist`)
            return Err(Msg.Dup_Name)
        }
        try {
            const nkey = KEY.zProjectNames(uid, chain)
            // get origin name
            const oname = await projRd.hget(key, 'name')
            projRd.zrem(nkey, oname!)
            projRd.hset(key, 'name', name)
            projRd.zadd(nkey, now(), name)
        } catch(e) {
            return Err(e)
        }
        return Ok(void(0))
    }
    
    static async updateStatus(chain: string, pid: IDT, status: ProStatus): PResultT<ProStatus> {
        const key = KEY.hProject(chain, pid)
        const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }

        try {
            projRd.hset(key, 'status', status)
            return Ok(status)
        } catch (e) {
            log.error('Set project status error: ', e)
            return Err(e)
        }
    }

    static async updateLimit(chain: string, pid: IDT, reqSecLimit?: number, bwDayLimit?: number): PResultT<void> {
        const key = KEY.hProject(chain, pid)
        log.debug(`update ${chain} project[${pid}] resource limit: ${reqSecLimit} ${bwDayLimit}`)
        const isOk =  await keyExist(key)
        if (!isOk) { return Err('invalid chain or pid') }
        try {
            if (reqSecLimit !== undefined) {
                projRd.hset(key, 'reqSecLimit', reqSecLimit)
            }
            if (bwDayLimit !== undefined) {
                projRd.hset(key, 'bwDayLimit', bwDayLimit)
            }
        } catch(e) {
            log.error(`update project resource limit error: ${e}`)
            return Err(e)
        }
        return Ok(void(0))
    }
}

export default Project