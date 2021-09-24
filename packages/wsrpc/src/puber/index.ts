import WebSocket from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, isErr, PVoidT, isNone } from '@elara/lib'
import { Option, None, Some } from '@elara/lib'
import { randomId } from '@elara/lib'
import { ReqDataT, ReqT, ReqTyp, Statistics } from '../interface'
import Matcher from '../matcher'
import Suber from '../suber'
import { Stat } from '../statistic'
import Util from '../util'
import { NodeType } from '../chain'
import Emiter from '../emiter'

const log = getAppLogger('puber')

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    nodeId: number,
    ws: WebSocket,
    topics: Set<string>,   // {subscribeId}
    subId: IDT,            // suber id
    kvSubId?: IDT,          // kv 
    memSubId?: IDT          // memory node
}

type KvReqT = {
    id: string,
    chain: string,
    request: string,
}

class Puber {
    private static g: Record<string, Puber> = {}

    private static reqs: Record<string, Set<string>> = {}

    private static topics: Record<string, Set<string>> = {}

    // pubers cache
    static get(pubId: IDT): Option<Puber> {
        if (!Puber.g[pubId]) {
            return None
        }
        return Some(Puber.g[pubId])
    }

    static getAll() {
        return this.g
    }

    static updateOrAdd(puber: Puber): void {
        Puber.g[puber.id] = puber
    }

    static del(pubId: IDT): void {
        // Pubers[pubId].topics?.clear()
        delete Puber.g[pubId]
    }

    // request cache
    static getReqs(pubId: IDT): Set<string> {
        return Puber.reqs[pubId]
    }

    static getAllReqs() {
        return Puber.reqs
    }

    static addReq(pubId: IDT, reqId: string): void {
        Puber.reqs[pubId].add(reqId)
    }

    static remReq(pubId: IDT, reqId: string): boolean {
        return Puber.reqs[pubId].delete(reqId)
    }

    static create(ws: WebSocket, chain: string, pid: IDT): Puber {
        const puber = { id: randomId(), pid, chain, ws, topics: new Set() } as Puber
        Puber.updateOrAdd(puber)
        Puber.reqs[puber.id] = new Set<string>()
        return puber
    }

    static async destroy(chain: string, pid: string, pubId: IDT): PVoidT {
        // 1. clear puber reqs
        const re = this.get(pubId)
        if (isNone(re)) {
            log.error(`${chain} pid[${pid}] puber[${pubId}] has gone or been cleared`)
            return
        }
        const reqs = this.reqs[pubId]
        const topics = this.topics[pubId]
        if (reqs === undefined || reqs.size === 0) { return }

        if (topics !== undefined && topics.size > 0) {
            new Emiter(`puber-close-${pubId}`, () => {
                log.info(`${chain} ${pid} puber[${pubId}] unsubscribe all topics done`)
            }, topics.size)
        }

        for (let reqId of reqs) {
            const reqRe = Matcher.getReqCache(reqId)
            if (isErr(reqRe)) {
                log.error(`[SBH] destroy ${chain} pid[${pid}] puber[${pubId}] error: %o`, reqRe.value)
                process.exit(1)
            }

            const req = reqRe.value as ReqT
            if (req.type !== ReqTyp.Sub) {
                Matcher.delReqCache(reqId)
                this.remReq(pubId, reqId)
                continue
            }

            // clear subscribe topic
            if (req.subsId === undefined) {
                log.error(`[SBH] clear ${chain} pid[${pid}] puber[${pubId}] subscribe topic error: subscribe ID undefined`)
                process.exit(1)
                // Matcher.delReqCache(reqId)
                // this.remReq(pubId, reqId)
                // continue
            }

            // before unsubscribe success, we cannot delete request cache
            // if suber has been closed, return success
            Suber.unsubscribe(chain, req.subType, req.subId, req.method, req.subsId)
        }
        delete this.g[pubId]
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

    static async transpond(puber: Puber, type: NodeType, data: ReqDataT, stat: Statistics): PVoidT {
        const start = Util.traceStart()
        const { chain, pid } = puber
        let subId = puber.subId
        if (type === NodeType.Kv) {
            subId = puber.kvSubId!
        } else if (type === NodeType.Mem) {
            subId = puber.memSubId!
        }
        let re = await Matcher.newRequest(puber, type, subId, data, stat)
        if (isErr(re)) {
            log.error(`${type} ${chain}-${pid} create new request error: ${re.value}`)
            stat.code = 500
            // publish statistics
            Stat.publish(stat)
            return puber.ws.send(re.value)
        }
        const dat = re.value
        let sendData: KvReqT | ReqDataT = dat
        if (type === NodeType.Kv) {
            sendData = {
                id: dat.id,
                chain: puber.chain,
                request: JSON.stringify(dat)
            } as KvReqT
        }

        let sre = Suber.getSuber(chain, type, subId!)
        if (isNone(sre)) {
            log.error(`send message error: invalid suber ${puber.subId} chain ${chain} type ${type}, suber may closed, close puber[${puber.id}] now`)
            // clear request cache
            Matcher.delReqCacheByPubStat(dat.id)
            puber.ws.terminate()
            return
        }
        const suber: Suber = sre.value
        // transpond requset
        log.info(`Send new message to ${type} suber[${suber.id}] of chain ${chain} request ID[${dat.id}], transpond delay: ${Util.traceEnd(start)}`)
        return suber.ws.send(JSON.stringify(sendData))
    }
}

export * from './dispatch'

export default Puber