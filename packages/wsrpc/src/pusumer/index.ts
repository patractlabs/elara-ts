import WebSocket, { EventEmitter } from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, PVoidT, isNone } from 'lib'
import { Option, None, Some } from 'lib'
import { randomId } from 'lib/utils'
import { WsData } from '../interface'
// import Matcher from './matcher'

const log = getAppLogger('Pusumer', true)

interface Pusumer {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    subId?: IDT,            // suber id
    topics?: Set<string>,   // {subscribeId}
    event?: EventEmitter
}

namespace Pusumer {
    export namespace G {
        const Pusumers: {[key in string]: Pusumer } = {}
        export const get = (pusId: IDT): Option<Pusumer> => {
            if (!Pusumers[pusId]) {
                return None
            }
            return Some(Pusumers[pusId])
        }

        export const updateOrAdd = (pusumer: Pusumer): void => {
            Pusumers[pusumer.id] = pusumer
        }
    }

    export const create = (ws: WebSocket, chain: string, pid: IDT): Pusumer => {
        const pusumer = { id: randomId(), pid, chain, ws } as Pusumer
        G.updateOrAdd(pusumer)
        return pusumer
    }

    export const updateTopics = (pusId: IDT, subsId: string): ResultT => {
        let re = G.get(pusId)
        if (isNone(re)) {
            log.error(`update puber[${pusId}] topics error: no this pusumer ${pusId}`)
            // puber may be closed
            return Err(`puber[${pusId}] may be closed`)
        }
        let puber = re.value as Pusumer
        puber.topics = puber.topics || new Set()
        puber.topics.add(subsId)

        G.updateOrAdd(puber)

        log.info(`update puber[${pusId}] topic [${subsId}] done: ${puber.topics.values()}`)
        return Ok(puber)
    }

    export const transpond = async (puber: Pusumer, data: WsData): PVoidT => {
        const { id, chain, pid }  = puber
        log.info(id, chain, pid, data)
        // // topic bind to chain and params 
        // if (Matcher.isSubscribed(chain, pid, data)){
        //     log.warn(`The topic [${data.method}] has been subscribed, no need to subscribe twice!`)
        //     data.error = {code: 1000, message: 'No need to subscribe twice'}
        //     return puber.ws.send(JSON.stringify(data))
        // }

        // let re = Matcher.newRequest(chain, pid, id, puber.subId!, data)
        // if (isErr(re)) {
        //     log.error(`create new request error: ${re.value}`)
        //     return puber.ws.send(re.value)
        // }
        // const dat = re.value

        // re = Matcher.getSuber(chain, id)
        // if (isErr(re)) {
        //     log.error(`[SBH] send message error: ${re.value}`)
        //     process.exit(1) 
        // }
        // const suber = re.value 

        // // transpond requset
        // log.info(`Send new message to suber[${suber.id}] of chain ${chain}, request ID: ${dat.id}`)
        // return suber.ws.send(JSON.stringify(dat))
    }
}

export default Pusumer