import WebSocket, { EventEmitter } from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, isErr, PVoidT, isNone } from 'lib'
import { Option, None, Some } from 'lib'
import { randomId } from 'lib/utils'
import { ReqDataT, WsData } from '../interface'
import Matcher from '../matcher'
import Suber, { SuberTyp } from '../matcher/suber'
import GG from '../global'

const log = getAppLogger('puber')

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    topics: Set<string>,   // {subscribeId}
    subId?: IDT,            // suber id
    event?: EventEmitter
    kvSubId?: IDT,          // kv suber
}

namespace Puber {
    export namespace G {
        const Pubers: { [key in string]: Puber } = {}
        export const get = (pubId: IDT): Option<Puber> => {
            if (!Pubers[pubId]) {
                return None
            }
            return Some(Pubers[pubId])
        }

        export const updateOrAdd = (puber: Puber): void => {
            Pubers[puber.id] = puber
        }

        export const del = (pubId: IDT) => {
            // Pubers[pubId].topics?.clear()
            delete Pubers[pubId]
        }
    }

    export const create = (ws: WebSocket, chain: string, pid: IDT): Puber => {
        const puber = { id: randomId(), pid, chain, ws, topics: new Set() } as Puber
        G.updateOrAdd(puber)
        return puber
    }

    export const updateTopics = (pubId: IDT, subsId: string): ResultT<Puber> => {
        let re = G.get(pubId)
        if (isNone(re)) {
            log.error(`update puber[${pubId}] topics error: no this puber ${pubId}`)
            // puber may be closed
            return Err(`puber[${pubId}] may be closed`)
        }
        let puber = re.value as Puber
        puber.topics = puber.topics || new Set()
        puber.topics.add(subsId)

        G.updateOrAdd(puber)

        log.info(`update puber[${pubId}] topic [${subsId}] done: `, puber.topics)
        return Ok(puber)
    }

    type KvReqT = {
        id: string,
        chain: string,
        request: string,
    }

    export const transpond = async (puber: Puber, type: SuberTyp, data: ReqDataT): PVoidT => {
        const { id, chain, pid } = puber
        const res = { id: data.id, jsonrpc: data.jsonrpc } as WsData
        // topic bind to chain and params 
        if (Matcher.isSubscribed(chain, pid, data)) {
            log.warn(`The topic [${data.method}] has been subscribed, no need to subscribe twice!`)
            res.error = { code: 1000, message: 'No need to subscribe twice' }
            return puber.ws.send(JSON.stringify(res))
        }
        let subId = puber.subId
        if (type === SuberTyp.Kv) {
            subId = puber.kvSubId
        }
        log.debug(`new request suber[${subId}] type ${type}`)
        let re = Matcher.newRequest(chain, pid, id, type, subId!, data)
        if (isErr(re)) {
            log.error(`create new request error: ${re.value}`)
            return puber.ws.send(re.value)
        }
        const dat = re.value
        let sendData: KvReqT | ReqDataT = dat
        if (type === SuberTyp.Kv) {
            sendData = {
                id: dat.id,
                chain: puber.chain,
                request: JSON.stringify(dat)
            } as KvReqT
        }

        // TODO
        let sre = GG.getSuber(chain, type, subId!)
        if (isNone(sre)) {
            log.error(`[SBH] send message error: invalid suber ${puber.subId} chain ${chain} type ${type}`)
            process.exit(1)
        }
        const suber: Suber = sre.value
        log.debug(`ready to send ${type} subscribe request: ${JSON.stringify(sendData)}`)
        // transpond requset
        log.info(`Send new message to suber[${suber.id}] of chain ${chain}, request ID: ${dat.id}`)
        return suber.ws.send(JSON.stringify(sendData))
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