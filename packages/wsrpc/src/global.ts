import { IDT, getAppLogger } from '@elara/lib'
import { ResultT, Err, Ok, Option, Some, None } from '@elara/lib'
import EventEmitter from 'events'
import { NodeType } from './chain'
import { SubscripT, PingT } from "./interface"
const log = getAppLogger('global')

export type SubscripMap = Record<string, SubscripT>

const TopicSubed: Record<string, SubscripMap> = {}

const SubMap: { [key in string]: string } = {}

let ID_CNT: number = 0

const TryCntMap: Record<string, number> = {}
const ConnCntMap: Record<string, Record<string, number>> = {}

const PuberEvt = new EventEmitter()
const SuberEnable: Record<string, boolean> = {}

class G {
    private static ServerStatus: Record<string, boolean> = {}

    private static Ping: Record<string, PingT> = {}

    static getServerStatus(chain: string, type: NodeType): boolean {
        return this.ServerStatus[`${chain}-${type}`]
    }

    static setServerStatus(chain: string, type: NodeType, status: boolean) {
        this.ServerStatus[`${chain}-${type}`] = status
    }

    static addPingCache(ping: PingT): void {
        this.Ping[ping.subId] = ping
    }

    static delPingCache(subId: IDT) {
        delete this.Ping[subId]
    }

    static getPingCache(subId: IDT): Option<PingT> {
        return this.Ping[subId] === undefined ? None : Some(this.Ping[subId])
    }

    static getAllPingCache(): Record<string, PingT> {
        return this.Ping
    }

    // suber enable cache
    static setSuberEnable(chain: string, type: NodeType, enable: boolean) {
        SuberEnable[`${chain}-${type}`] = enable
    }

    static getSuberEnable(chain: string, type: NodeType): boolean {
        return SuberEnable[`${chain}-${type}`]
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

    static getTryMap() {
        return TryCntMap
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

    static getConnMap() {
        return ConnCntMap
    }

    // 
    static addSubReqMap(subsId: string, id: string) {
        if (SubMap[subsId]) {
            log.error(`add new subscribe map error: subscribe ID exist`)
            process.exit(2)
        }
        SubMap[subsId] = id
    }

    static getReqId(subsId: string): ResultT<string> {
        if (!SubMap[subsId]) {
            return Err(`No this request, subscription ${subsId}`)
        }
        return Ok(SubMap[subsId])
    }

    static delSubReqMap(subsId: string): void {
        delete SubMap[subsId]
    }

    static getAllSubReqMap() {
        return SubMap
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

    static getAllSubTopics(): Record<string, SubscripMap> {
        return TopicSubed
    }
}

export default G