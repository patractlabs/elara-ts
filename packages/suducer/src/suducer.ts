import WebSocket from 'ws'
import { IDT } from 'lib'
import { randomId, md5 } from 'lib/utils'
import { TopicT } from './interface'

export enum SuducerT {
    Sub     = 'sub',        // suscription except author_submitAndWatchExtrinistic
    Cache   = 'cache'      // cacheable,
}

export enum SuducerStat {
    Active  = 'active',
    Check   = 'check',     
    Fail    = 'fail',
}

interface Suducer {
    id: IDT,
    ws: WebSocket,
    chainId: IDT,      // chain scale, hash(name, url)
    chain: string,
    url: string,        // host:port
    type: SuducerT,
    cluster: number,    // 0 no-cluster, 1-N cluster ID, default 0
    topic?: TopicT,      //  when type === Sub
    stat?: SuducerStat,
}

namespace Suducer {
    export const create = (chain: string, type: SuducerT, ws: WebSocket, url: string, topic?: TopicT, 
        cluster: number = 0): Suducer => {
        
        const suducer = {
            id: randomId(),
            chainId: md5(`${chain}${url}${cluster}`),
            cluster,
            ws,
            chain,
            topic,
            url,
            type,
        }
        return suducer
    }
}
export default Suducer