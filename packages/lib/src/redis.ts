import IORedis, { RedisOptions } from 'ioredis'

export enum DBT {
    Account = 0,
    Project = 1,
    Stat = 2,
    Chain = 3,
    Cache = 4,
    Pubsub = 8,
}

export interface RArgT {
    port?: number,
    host?: string,
    options?: RedisOptions
}

export type RdT = IORedis.Redis

export interface RClientT {
    client: RdT,
    db: DBT
}

export class Redis {
    protected client: RdT
    private db: DBT

    constructor(db: DBT, arg?: RArgT) {
        const options = { ...arg?.options, db }
        this.client = new IORedis(arg?.port, arg?.host, options)
        this.db = db
    }

    getDB(): DBT {
        return this.db
    }

    getClient(): RdT {
        return this.client
    }

    onConnect(cb?: () => void) {
        this.client.once('connect', () => { cb && cb() })
    }

    onError(cb?: (err: any) => void) {
        this.client.on('error', (err) => {
            cb && cb(err)
        })
    }

    onMsg(cb?: (topic: string, data: any) => void) {
        this.client.on('message', (topic, data) => {
            cb && cb(topic, data)
        })
    }

    onPMsg(cb?: (topic: string, data: any, pat?: string) => void) {
        this.client.on('pmessage', (pat, topic, data) => {
            cb && cb(topic, data, pat)
        })
    }
}