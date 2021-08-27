import fs from 'fs'
import Argparse from 'minimist'
import Mom from 'moment'
import { getAppLogger, randomId, KEYS, Redis, DBT, PVoidT, isErr, Ok, Err } from '@elara/lib'
import ProjectModel, { ProAttr, ProStatus } from '../api/src/models/project'
import Limit from '../api/src/service/limit'
import Chain from '../api/src/service/chain'
import UserModel, { UserLevel, UserStat } from '../api/src/models/user'
import LimitModel from '../api/src/models/limit'
import ChainModel from '../api/src/models/chain'
import ChainConfigModel from '../api/src/models/chain-config'

import sequelize from '../api/src/sequelize'

// const get = Got.get
// const post = Got.post
const log = getAppLogger('migrate')
const ProRd = new Redis(DBT.Project, {
    host: "47.111.179.222", port: 6379, options: {
        password: "LlZ9L8zx13ASshRysD3bCQ"
    }
}).getClient()

const UserRd = new Redis(DBT.User, {
    host: "47.111.179.222", port: 6379, options: {
        password: "LlZ9L8zx13ASshRysD3bCQ"
    }
}).getClient()

const StatRd = new Redis(DBT.Stat, {
    host: "47.111.179.222", port: 6379, options: {
        password: "LlZ9L8zx13ASshRysD3bCQ"
    }
}).getClient()

// const url = 'http://localhost:7000/api'

export async function migrateProjectCreate(pro: ProAttr): PVoidT {
    try {
        let chain = pro.chain.toLowerCase()
        if (chain === 'moonbase') { chain = 'moonbasealpha' }
        if (chain === 'moonbeam') { chain = 'moonriver' }
        const cre = await Chain.findByName(chain)
        if (isErr(cre)) {
            log.error(`create project error: %o`, cre.value)
            return
        }
        const chainAttr = cre.value
        const re = await ProjectModel.create({
            ...pro,
            chain,
            team: chainAttr.team,
            network: chainAttr.network,
            secret: randomId(),
            status: ProStatus.Active,
            reqSecLimit: -1,
            reqDayLimit: -1,
            bwDayLimit: -1
        })
        if (re === null) {
            log.error('create error')
        }
        await ProRd.hmset(KEYS.Project.hProjectStatus(chain, pro.pid), 'status', 'active', 'user', pro.userId)
    } catch (err) {
        log.error('create project error: %o', err)
    }
}

export async function migrateUserCreate(githubId: string, name: string) {
    log.info('create user: %o %o', githubId, name)

    const re = await Limit.findByLevel(UserLevel.Normal)
    if (isErr(re)) {
        log.error(`find limit by level error: %o`, re.value)
        return re
    }
    const levelId = re.value.id
    const user = {
        githubId,
        name,
        levelId,
        level: UserLevel.Normal,
        status: UserStat.Active,
        loginType: 'github'
    } as UserModel
    try {
        const re = await UserModel.create(user)
        if (!re.id) {
            log.error('create user error')
        }
        log.debug('UserModel create result: %o', re.id)
        await UserRd.hset(KEYS.User.hStatus(re.id), 'status', 'active')
        return Ok(re)
    } catch (err) {
        log.error('create user error: %o', err)
        return Err(err.errors[0].message ?? 'create error')
    }

}

export async function parseData() {
    const fil = JSON.parse(fs.readFileSync('/root/data_test.json', 'utf-8').toString())

    // log.info('data: ', fil)

    const ids = Object.keys(fil)
    let nouserCnt = 0
    log.info('users count: %o', ids.length)
    for (let githubId of ids) {
        log.info('githubId: %o', githubId)
        const item = fil[githubId]
        if (item.length === 0) {
            nouserCnt += 1
            continue
        }
        let user = item[0].username
        const userre = await migrateUserCreate(githubId, user)
        if (isErr(userre)) {
            log.error(`create user ${user} githuid[${githubId}] error: %o`, userre.value)
            continue
        }
        const nuser = userre.value
        for (let pro of item) {
            let project = {
                chain: pro.chain,
                name: pro.name,
                pid: pro.id,
                status: 'active',
                userId: nuser.id
            } as ProAttr
            await migrateProjectCreate(project)
        }
    }
    log.info('no project user count: %o', nouserCnt)
}

export async function migrateStat(): PVoidT {
    const brio = 4096
    const total = 3371960000
    const days = [
        20000000, 33378254, 29348368, 29210373,
        21474461, 20435833, 21464380, 24482837,
        24262119, 35270618, 37619695, 32578934,
        25604408, 24437699, 33058490, 24242706,
        25790072, 27814090, 27360400, 32993384,
        37143149, 38297063, 35378722, 31685328,
        28350828, 26995892, 27974337, 25921432,
        27089562, 34275529]
    StatRd.hmset(KEYS.Stat.hTotal(), 'bw', total * brio, 'reqCnt', total)
    for (let i = 0; i < 30; i++) {
        const stamp = Mom().subtract(i, 'days').startOf('day').valueOf()
        StatRd.hmset(KEYS.Stat.hDaily(stamp), 'bw', days[i] * brio, 'reqCnt', days[i])
    }
}

async function main() {
    const args = Argparse(process.argv.slice(2))
    log.info('args: %o', args)
    sequelize.addModels([UserModel, ProjectModel, ChainModel, ChainConfigModel, LimitModel])

    await sequelize.sync()
    // await mockUser(url)
    await parseData()
    process.exit()
}

main()