import { getAppLogger, IDT } from '@elara/lib'
import { ResultT, Err, Ok } from '@elara/lib'
import EventEmitter from 'events'
import { ReqT, Statistics, SubscripT } from "./interface"
import { Stat } from './statistic'
const log = getAppLogger('global')

export type SubscripMap = { [key in string]: SubscripT }
type TopicSubedT = { [key in string]: SubscripMap }
const TopicSubed: TopicSubedT = {}

const SubMap: { [key in string]: IDT } = {}

export type ReqMap = { [key in string]: ReqT }
const ReqMap: ReqMap = {}

let ID_CNT: number = 0

const TryCntMap: { [key in string]: number } = {}
const ConnCntMap: { [key in string]: { [key in string]: number } } = {}

const PuberEvt = new EventEmitter()
const KVEnable: Record<string, boolean> = {}
const MemEnable: Record<string, boolean> = {}

class G {

    // kv enable cache
    static setKvEnable(chain: string, enable: boolean) {
        KVEnable[`${chain.toLowerCase()}`] = enable
    }

    static getKvEnable(chain: string): boolean {
        return KVEnable[`${chain.toLowerCase()}`]
    }

    // memory node enable cache
    static setMemEnable(chain: string, enable: boolean) {
        MemEnable[`${chain.toLowerCase()}`] = enable
    }

    static getMemEnable(chain: string): boolean {
        return MemEnable[`${chain.toLowerCase()}`]
    }

    // puber event
    static getPuberEvent(): EventEmitter {
        return PuberEvt
    }

    static getID(): number {
        return ID_CNT++
    }

    static resetTryCnt(chain: string) {
        TryCntMap[chain] = 0
    }

    static incrTryCnt(chain: string) {
        chain = chain
        TryCntMap[chain] = 1 + TryCntMap[chain] || 0
    }

    static getTryCnt(chain: string) {
        return TryCntMap[chain] || 0
    }

    static incrConnCnt(chain: string, pid: IDT) {
        chain = chain
        ConnCntMap[chain] = ConnCntMap[chain] || {}
        ConnCntMap[chain][pid] = ConnCntMap[chain][pid] || 0
        ConnCntMap[chain][pid] += 1
    }

    static decrConnCnt(chain: string, pid: IDT) {
        ConnCntMap[chain][pid] -= 1
        if (ConnCntMap[chain][pid] < 1) {
            delete ConnCntMap[chain][pid]
        }
    }

    static delConnCnt(chain: string, pid: IDT) {
        delete ConnCntMap[chain][pid]
    }

    static getConnCnt(chain: string, pid: IDT): number {
        if (!ConnCntMap[chain] || !ConnCntMap[chain][pid]) {
            return 0
        }
        return ConnCntMap[chain][pid]
    }

    // 
    static addSubReqMap(subsId: string, id: IDT) {
        if (SubMap[subsId]) {
            log.error(`add new subscribe map error: subscribe ID exist`)
            process.exit(2)
        }
        SubMap[subsId] = id
    }

    static getReqId(subsId: string): ResultT<IDT> {
        if (!SubMap[subsId]) {
            return Err(`No this request, subscription ${subsId}`)
        }
        return Ok(SubMap[subsId])
    }

    static delSubReqMap(subsId: string): void {
        delete SubMap[subsId]
        log.debug(`delete subscribe Id map: ${subsId}`)
    }

    static getSubReqMap() {
        return SubMap || {}
    }

    // 
    static addReqCache(req: ReqT): void {
        if (ReqMap[req.id]) {
            log.error(`add new request cache error: ${req.id} exist`)
            process.exit(2)
        }
        ReqMap[req.id] = req
    }

    static updateReqCache(req: ReqT): void {
        ReqMap[req.id] = req
    }

    static delReqCache(reqId: IDT): void {
        delete ReqMap[reqId]
    }

    static delReqCacheByPubStatis(reqId: IDT, publish: (stat: Statistics) => void = Stat.publish): void {
        if (ReqMap[reqId]) {
            const stat = ReqMap[reqId].stat
            publish(stat)
            delete ReqMap[reqId]
        } else {
            log.warn(`request cache ${reqId} invalid: %o`, ReqMap[reqId])
        }
    }

    static getReqCache(reqId: IDT): ResultT<ReqT> {
        if (!ReqMap[reqId]) {
            return Err(`invalid request id ${reqId}`)
        }
        return Ok(ReqMap[reqId])
    }

    static getAllReqCache() {
        return ReqMap
    }

    static addSubTopic(chain: string, pid: IDT, topic: SubscripT): void {
        const key = `${chain}-${pid}`

        TopicSubed[key] = TopicSubed[key] || {}
        TopicSubed[key][topic.id] = topic
    }

    static remSubTopic(chain: string, pid: IDT, subsId: string): void {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key]) return

        delete TopicSubed[key][subsId]
        if (Object.keys(TopicSubed[key]).length == 0) {
            delete TopicSubed[key]
        }
    }

    static getSubTopic(chain: string, pid: IDT, subsId: IDT): ResultT<SubscripT> {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key] || !TopicSubed[key][subsId]) {
            return Err(`Invalid subscribed topic: chain ${chain} pid[${pid} id[${subsId}]`)
        }
        return Ok(TopicSubed[key][subsId])
    }

    static getSubTopics(chain: string, pid: IDT): SubscripMap {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key]) {
            return {}
        }
        return TopicSubed[key]
    }

    static getAllSubTopics(): TopicSubedT {
        return TopicSubed
    }
}

export default G