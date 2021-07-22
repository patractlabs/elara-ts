import { Redis, DBT, RArgT } from './redis'
import { getAppLogger } from './log'

const log = getAppLogger('mq')

export type SubCbT = (data: any) => void

export class Subscriber extends Redis {
    constructor(db: DBT = DBT.Pubsub, arg?: RArgT) {
        super(db, arg)
    }

    async subscribe(chan: string, cb: SubCbT, grp?: string, user?: string, ms: number = 5000): Promise<void> {
        let lastID = '>'
        let typ = 'group'
        let consumer = user
        if (!grp) {
            lastID = '$'
            typ = ''
            consumer = ''
        }
        while (true) {
            try {
                let re
                if (grp && user) {
                    re = await this.client.xreadgroup('GROUP', grp, user, 'BLOCK', ms, 'STREAMS', chan, lastID)
                } else {
                    re = await this.client.xread('BLOCK', ms, 'STREAMS', chan, lastID)
                }
                if (!re) {
                    log.info(`${consumer} no new ${typ} stream`)
                    continue
                }
                let res = re[0][1]
                const { length } = re
                log.info(`${typ} stream ${consumer} read result: `, res, length)
                if (!length) { continue }
                cb(res)
            } catch (err) {
                log.error(`${typ} stram subscribe error: `, err)
            }
        }
    }
}

export class Producer extends Redis {
    private grp: string
    constructor({ db = DBT.Pubsub, grp, arg }: { db: DBT, grp?: string, arg?: RArgT }) {
        super(db, arg)
        this.grp = grp ?? ''
    }

    getGroup(): string {
        return this.grp
    }

    async publish(chan: string, kvs: string[], maxlen: number = 1, id: string = '*'): Promise<string> {
        return this.client.xadd(chan, 'MAXLEN', maxlen, id, kvs)
    }

    createGroup(grp: string, chan: string) {
        this.grp = grp
        this.client.xgroup('create', chan, grp)
    }
}

export interface StreamInfoT {
    length: number,
    radixTreeKeys: number,
    radixTreeNodes: number,
    lastGeneratedId: string,
    groups: number,
    firstEntry: any,
    lastEntry: any
}

export interface GroupInfoT {
    name: string,
    consumers: number,
    pending: number,
    lastDeliveredId: string,
}

export type GroupListT = GroupInfoT[]

export interface ConsumerInfoT {
    name: string,
    pending: number,
    idle: number,
}

export type ConsumerListT = ConsumerInfoT[]

class Mq extends Redis {

    constructor(db: DBT = DBT.Pubsub, arg?: RArgT) {
        super(db, arg)
    }

    async streamInfo(chan: string): Promise<StreamInfoT> {
        let re = await this.client.xinfo('STREAM', chan)

        return {
            length: re[1],
            radixTreeKeys: re[3],
            radixTreeNodes: re[5],
            lastGeneratedId: re[7],
            groups: re[9],
            firstEntry: re[11],
            lastEntry: re[13]
        } as StreamInfoT
    }

    async groupInfo(chan: string): Promise<GroupListT> {
        let re = await this.client.xinfo('GROUPS', chan)
        let res: GroupListT = []
        for (let g of re) {
            let ginfo = {
                name: g[1],
                consumers: g[3],
                pending: g[5],
                lastDeliveredId: g[7]
            } as GroupInfoT
            res.push(ginfo)
        }
        return res
    }

    async consumerInfo(grp: string, chan: string): Promise<ConsumerListT> {
        let re = await this.client.xinfo('CONSUMERS', chan, grp)
        log.info('result of consumer: ', JSON.stringify(re))
        let res: ConsumerListT = []
        for (let c of re) {
            let cinfo = {
                name: c[1],
                pending: c[3],
                idle: c[5]
            }
            res.push(cinfo)
        }
        return res
    }
}

export default Mq