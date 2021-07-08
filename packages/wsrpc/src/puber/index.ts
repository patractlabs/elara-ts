import WebSocket, { EventEmitter } from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, isErr, PVoidT, isNone } from 'lib'
import { Option, None, Some } from 'lib'
import { randomId } from 'lib/utils'
import { ReqDataT, WsData } from '../interface'
import Matcher from '../matcher'
import Suber, { SuberTyp } from '../matcher/suber'

const log = getAppLogger('puber', true)

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    subId?: IDT,            // suber id
    topics?: Set<string>,   // {subscribeId}
    event?: EventEmitter
    kvSubId?: IDT,          // kv suber
}

namespace Puber {
    export namespace G {
        const Pubers: {[key in string]: Puber } = {}
        export const get = (dispId: IDT): Option<Puber> => {
            if (!Pubers[dispId]) {
                return None
            }
            return Some(Pubers[dispId])
        }

        export const updateOrAdd = (puber: Puber): void => {
            Pubers[puber.id] = puber
        }

        export const del = (pubId: IDT) => {
            Pubers[pubId].topics?.clear()
            delete Pubers[pubId]
        }
    }

    export const create = (ws: WebSocket, chain: string, pid: IDT): Puber => {
        const puber = { id: randomId(), pid, chain, ws } as Puber
        G.updateOrAdd(puber)
        return puber
    }

    export const updateTopics = (dispId: IDT, subsId: string): ResultT => {
        let re = G.get(dispId)
        if (isNone(re)) {
            log.error(`update puber[${dispId}] topics error: no this puber ${dispId}`)
            // puber may be closed
            return Err(`puber[${dispId}] may be closed`)
        }
        let puber = re.value as Puber
        puber.topics = puber.topics || new Set()
        puber.topics.add(subsId)

        G.updateOrAdd(puber)

        log.info(`update puber[${dispId}] topic [${subsId}] done: ${puber.topics.values()}`)
        return Ok(puber)
    }

    export const transpond = async (puber: Puber, type: SuberTyp, data: ReqDataT): PVoidT => {
        const { id, chain, pid }  = puber
        const res = {id: data.id, jsonrpc: data.jsonrpc } as WsData
        // topic bind to chain and params 
        if (Matcher.isSubscribed(chain, pid, data)){
            log.warn(`The topic [${data.method}] has been subscribed, no need to subscribe twice!`)
            res.error = {code: 1000, message: 'No need to subscribe twice'}
            return puber.ws.send(JSON.stringify(res))
        }
        let subId = puber.subId
        if (type === SuberTyp.Kv) {
            subId = puber.kvSubId
        }
        let re: any = Matcher.newRequest(chain, pid, id, type, subId!, data)
        if (isErr(re)) {
            log.error(`create new request error: ${re.value}`)
            return puber.ws.send(re.value)
        }
        const dat = re.value

        // TODO
        re = Suber.G.get(chain, type, puber.subId!)
        if (isNone(re)) {
            log.error(`[SBH] send message error: invalid suber ${puber.subId} chain ${chain}`)
            process.exit(1) 
        }
        const suber = re.value 

        // transpond requset
        log.info(`Send new message to suber[${suber.id}] of chain ${chain}, request ID: ${dat.id}`)
        return suber.ws.send(JSON.stringify(dat))
    }

    export enum CloseReason {
        Node = 'node service unavailable',
        Kv = 'kv service unavailable',
        OutOfLimit = 'out of connect limit',
        SuberUnavail = 'suber unavailable'
    }
}

export * from './dispatch'

export default Puber