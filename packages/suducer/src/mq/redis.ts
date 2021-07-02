import Redis, { RClientT, DBT } from 'lib/utils/redis'
import { getAppLogger } from 'lib'

const log = getAppLogger('mq-redis', true)

type SubCbT = (data: any) => void

export interface Subscriber {
    rd: RClientT
}

const subListen = () => {

}

export class Subscriber {
    constructor(db: DBT = DBT.Pubsub) {
        this.rd = Redis.newClient(db)
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
                    re = await this.rd.client.xreadgroup('GROUP', grp, user, 'BLOCK', ms, 'STREAMS', chan, lastID)
                } else {
                    re = await this.rd.client.xread('BLOCK', ms, 'STREAMS', chan, lastID)
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
            } catch(err) {
                log.error(`${typ} stram subscribe error: `, err)
            }
        }
    }
}

export interface Producer {
    rd: RClientT,
    grp: string,
    // publish: (chan: string, kvs: string[], id?: string) => Promise<string>
}

export class Producer {
    constructor(db: DBT, grp?: string) {
        this.rd = Redis.newClient(db)
        if (grp) {
            this.grp = grp
        }
    }

    async publish(chan: string, kvs: string[], maxlen: number = 1, id: string = '*'): Promise<string> {
        return this.rd.client.xadd(chan, 'MAXLEN', maxlen, id, kvs)
    }

    createGroup(grp: string, chan: string) {
        this.grp = grp
        this.rd.client.xgroup('create', chan, grp)
    }
}
const Mqrd = Redis.newClient(DBT.Pubsub).client

interface StreamInfoT {
    length: number,
    radixTreeKeys: number,
    radixTreeNodes: number,
    lastGeneratedId: string,
    groups: number,
    firstEntry: any,
    lastEntry: any
}

interface GroupInfoT {
    name: string,
    consumers: number,
    pending: number,
    lastDeliveredId: string,
}

type GroupListT = GroupInfoT[]

interface ConsumerInfoT {
    name: string,
    pending: number,
    idle: number,
}

type ConsumerListT = ConsumerInfoT[]

namespace Rmq {

    export const streamInfo = async (chan: string): Promise<StreamInfoT> => {
        let re = await Mqrd.xinfo('STREAM', chan)

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

    export const groupInfo = async (chan: string): Promise<GroupListT> => {
        let re = await Mqrd.xinfo('GROUPS', chan)
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

    export const consumerInfo = async (grp: string, chan: string): Promise<ConsumerListT> => {
        let re = await Mqrd.xinfo('CONSUMERS', chan, grp)
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
export default Rmq

const sub = new Subscriber()
sub.subscribe('chan', console.log)
sub.subscribe('chan', console.log, 'grp', 'bruce')
sub.subscribe('chan', console.log)
sub.subscribe('chan', console.log, 'grp', 'xn')

const run = async() => {
    let sinfo = await Rmq.streamInfo('chan')
    log.info('stream info: ', JSON.stringify(sinfo), sinfo.groups, sinfo.firstEntry[0])

    let ginfo = await Rmq.groupInfo('chan')
    log.info('group info: ', JSON.stringify(ginfo), ginfo[0].name)

    let cinfo = await Rmq.consumerInfo('grp', 'chan')
    log.info('consumer info: ', JSON.stringify(cinfo), cinfo[0].name)
}   
// run()