import WebSocket, { EventEmitter } from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, isErr, PVoidT, isNone } from '@elara/lib'
import { Option, None, Some } from '@elara/lib'
import { randomId } from '@elara/lib'
import { ReqDataT, Statistics } from '../interface'
import Matcher from '../matcher'
import Suber, { SuberTyp } from '../matcher/suber'
import G from '../global'
import { Stat } from '../statistic'

const log = getAppLogger('puber')

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    topics: Set<string>,   // {subscribeId}
    subId: IDT,            // suber id
    event?: EventEmitter
    kvSubId?: IDT,          // kv suber
}

type KvReqT = {
    id: string,
    chain: string,
    request: string,
}

class Puber {
    private static g: Record<string, Puber> = {}

    static get(pubId: IDT): Option<Puber> {
        if (!Puber.g[pubId]) {
            return None
        }
        return Some(Puber.g[pubId])
    }

    static updateOrAdd(puber: Puber): void {
        Puber.g[puber.id] = puber
    }

    static del(pubId: IDT): void {
        // Pubers[pubId].topics?.clear()
        delete Puber.g[pubId]
    }

    static create(ws: WebSocket, chain: string, pid: IDT): Puber {
        const puber = { id: randomId(), pid, chain, ws, topics: new Set() } as Puber
        Puber.updateOrAdd(puber)
        return puber
    }

    static updateTopics(pubId: IDT, subsId: string): ResultT<Puber> {
        let re = Puber.get(pubId)
        if (isNone(re)) {
            log.error(`update puber[${pubId}] topics error: no this puber ${pubId}`)
            // puber may be closed
            return Err(`puber[${pubId}] may be closed`)
        }
        let puber = re.value as Puber
        puber.topics = puber.topics || new Set()
        if (puber.topics.has(subsId)) {
            log.error(`${puber.chain} puber[${puber.id}] has subscribed topic[${subsId}] existed!`)
        }
        puber.topics.add(subsId)

        Puber.updateOrAdd(puber)

        log.info(`update puber[${pubId}] topic [${subsId}] done, current topic size: %o`, puber.topics.size)
        return Ok(puber)
    }

    static async transpond(puber: Puber, type: SuberTyp, data: ReqDataT, stat: Statistics): PVoidT {
        const { id, chain, pid } = puber

        // polkadotapps will subscribe more than once
        // const res = { id: data.id, jsonrpc: data.jsonrpc } as WsData
        // topic bind to chain and params 
        // if (Matcher.isSubscribed(chain, pid, data)) {
        //     log.warn(`The pid[${puber.pid}] puber[${puber.id}] has subscribed topic [${data.method}], no need to subscribe twice!`)
        //     res.error = { code: 1000, message: 'No need to subscribe twice' }
        //     const sres = JSON.stringify(res)
        //     return puber.ws.send(sres)
        // }
        let subId = puber.subId
        if (type === SuberTyp.Kv) {
            subId = puber.kvSubId!
        }
        let re = Matcher.newRequest(chain, pid, id, type, subId!, data, stat)
        if (isErr(re)) {
            log.error(`create new request error: ${re.value}`)
            stat.code = 500
            // publish statistics
            Stat.publish(stat)
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
        let sre = Suber.getSuber(chain, type, subId!)
        if (isNone(sre)) {
            log.error(`send message error: invalid suber ${puber.subId} chain ${chain} type ${type}, may closed`)
            // clear request cache
            // G.delReqCache(dat.id)
            G.delReqCacheByPubStatis(dat.id)
            return
        }
        const suber: Suber = sre.value
        log.debug(`ready to send ${type} subscribe request: ${JSON.stringify(sendData)}`)
        // transpond requset
        log.info(`Send new message to ${type} suber[${suber.id}] of chain ${chain}, request ID: ${dat.id}`)
        return suber.ws.send(JSON.stringify(sendData))
    }
}

export * from './dispatch'

export default Puber