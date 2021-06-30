import Redis, { RClientT, DBT } from 'lib/utils/redis'
import { getAppLogger } from 'lib'

const log = getAppLogger('mq-redis', true)

type SubCbT = (data: any) => void

interface Subscriber {
    rd: RClientT
}

class Subscriber {
    constructor(db: DBT = DBT.Pubsub) {
        this.rd = Redis.newClient(db)
    }

    async subscribe(chan: string, cb: SubCbT, ms: number = 5000): Promise<void> {
        let lastID = '$'
        while (true) {
            let re = await this.rd.client.xread('BLOCK', ms, 'STREAMS', chan, lastID)
            if (!re) { 
                log.info('no new stream')
                continue 
            }
            let res = re[0][1]
            const { length } = res
            log.info('stream read result: ', res, length)
            if (!length) { continue }
            cb(res)
            // lastID = res[length - 1][0]
        }
    }
}

interface Producer {
    rd: RClientT,
    grp: string,
    // publish: (chan: string, kvs: string[], id?: string) => Promise<string>
}

interface Subscriber {
    sub: () => any
}

class Producer {
    constructor(db: DBT = DBT.Pubsub) {
        this.rd = Redis.newClient(db)
    }

    async publish(chan: string, kvs: string[], maxlen: number = 1, id: string = '*'): Promise<string> {
        return this.rd.client.xadd(chan, 'MAXLEN', maxlen, id, kvs)
    }

}


const pro = new Producer()
setInterval(()=> {
    pro.publish('chan', ['age', '18', 'sex', 'male'])
}, 3000)