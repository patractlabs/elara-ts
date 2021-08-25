import Http from 'http'
import { ChainAttr, Network } from '../api/src/models/chain'
import { LimitAttr } from '../api/src/models/limit'
import { LoginType, UserLevel } from '../api/src/models/user'

const log = console

const authSec = 'auth7878@elara.com'

export function get(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        let data = ''
        const req = Http.get(url, {
            auth: authSec,
        }, (res: Http.IncomingMessage) => {
            res.on('data', (chunk) => {
                data += chunk
            })
            res.on('end', () => {
                log.debug('response: %o', data)
                resolve(data)
            })
        })
        req.on('error', (err: Error) => {
            log.error('post noder rpc request error: %o', err)
            reject({ code: 500, msg: err, data: false })
        })
        req.end()
    })
}

export function post(url: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
        let data = ''
        const req = Http.request(url, {
            method: 'POST',
            auth: authSec,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json; charset=UTF-8'
            }
        }, (res: Http.IncomingMessage) => {
            res.on('data', (chunk) => {
                data += chunk
            })
            res.on('end', () => {
                log.debug('response: %o', data)
                resolve(data)
            })
        })
        req.on('error', (err: Error) => {
            log.error('post noder rpc request error: %o', err)
            reject({ code: 500, msg: err, data: false })
        })
        req.write(JSON.stringify(body))
        req.end()
    })
}

export async function mockLimit(url: string) {
    const limits: LimitAttr[] = [
        {
            level: UserLevel.Normal,
            projectNum: 10,
            reqDayLimit: 100000,
            reqSecLimit: 5,
            bwDayLimit: 1000000000
        },
        {
            level: UserLevel.Bronze,
            projectNum: 20,
            reqDayLimit: 200000,
            reqSecLimit: 10,
            bwDayLimit: 2000000000
        },
        {
            level: UserLevel.Silver,
            projectNum: 50,
            reqDayLimit: 500000,
            reqSecLimit: 15,
            bwDayLimit: 5000000000
        },
        {
            level: UserLevel.Golden,
            projectNum: 100,
            reqDayLimit: 1000000,
            reqSecLimit: 20,
            bwDayLimit: 10000000000
        },

    ] as LimitAttr[]

    limits.forEach(async limit => {
        await post(url + '/limit/add', limit)
    })
}


export async function mockChain(url: string) {
    const chains = [
        {
            name: 'Polkadot',
            network: Network.Polkadot,
            team: 'Parity'
        },
        {
            name: 'Kusama',
            network: Network.Kusama,
            team: 'Parity'
        },
        {
            name: 'Statemine',
            network: Network.Kusama,
            team: 'Parity'
        },
        {
            name: 'Karura',
            network: Network.Kusama,
            team: 'Acala'
        },
        {
            name: 'Moonriver',
            network: Network.Kusama,
            team: 'Moonbeam'
        },
        {
            name: 'Bifrost',
            network: Network.Kusama,
            team: 'Bifrost'
        },
        {
            name: 'Westend',
            network: Network.Westend,
            team: 'Parity'
        },
        {
            name: 'Westmint',
            network: Network.Westend,
            team: 'Parity'
        },
        {
            name: 'Rococo',
            network: Network.Rococo,
            team: 'Parity'
        },
        {
            name: 'Darwinia',
            network: Network.Live,
            team: 'Darwinia'
        },
        {
            name: 'Dock',
            network: Network.Live,
            team: 'Dock'
        },
        {
            name: 'Edgeware',
            network: Network.Live,
            team: 'Edgeware'
        },
        {
            name: 'Kulupu',
            network: Network.Live,
            team: 'Kulupu'
        },
        {
            name: 'Nodle',
            network: Network.Live,
            team: 'Nodle'
        },
        {
            name: 'Plasm',
            network: Network.Live,
            team: 'Plasm'
        },
        {
            name: 'Stafi',
            network: Network.Live,
            team: 'Stafi'
        },
        {
            name: 'ChainX',
            network: Network.Live,
            team: 'ChainX'
        },
        {
            name: 'Subsocial',
            network: Network.Live,
            team: 'Subsocial'
        },
        {
            name: 'Jupiter',
            network: Network.Test,
            team: 'Patract'
        }
    ] as ChainAttr[]
    for (let chain of chains) {
        log.info('create chain: ', chain)
        await post(url + '/chain/add', chain)
    }
}

export async function mockUser(url: string) {
    const user = {
        name: 'Bruce',
        loginType: LoginType.Github,
        githubId: 'TestUID'

    }
    post(url + '/user/create', user)
}

export async function mockProject(url: string) {
    const pros = [
        {
            name: 'web3',
            team: 'Parity',
            chain: 'Polkadot',
            network: 'Polkadots',
            userId: 1,
            reqDayLimit: 10000,
            reqSecLimit: 100,
            bwDayLimit: 102400000000000000
        }
    ]
    pros.forEach(async p => {
        await post(url + '/project/create', p)
    })
}

export async function auth(url: string) {
    get(url + '/stat/total')
}

async function mockRun() {
    const url = 'http://127.0.0.1:7000/api'
    log.info('current url: ', url)
    // await mockLimit(url)
    await mockChain(url)
    // await mockUser(url)
    // await auth(url)
    // await mockProject(url)
}

mockRun()