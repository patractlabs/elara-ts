import { getAppLogger, IDT } from 'elara-lib'
import { ResultT, Err, Ok } from 'elara-lib'
import { ReqT, SubscripT } from "./interface"
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

namespace G {

    export const getID = (): number => {
        return ID_CNT++
    }

    export const resetTryCnt = (chain: string) => {
        TryCntMap[chain] = 0
    }

    export const incrTryCnt = (chain: string) => {
        chain = chain
        TryCntMap[chain] = 1 + TryCntMap[chain] || 0
    }

    export const getTryCnt = (chain: string) => {
        return TryCntMap[chain] || 0
    }

    export const incrConnCnt = (chain: string, pid: IDT) => {
        chain = chain
        ConnCntMap[chain] = ConnCntMap[chain] || {}
        ConnCntMap[chain][pid] = ConnCntMap[chain][pid] || 0
        ConnCntMap[chain][pid] += 1
    }

    export const decrConnCnt = (chain: string, pid: IDT) => {
        ConnCntMap[chain][pid] -= 1
        if (ConnCntMap[chain][pid] < 1) {
            delete ConnCntMap[chain][pid]
        }
    }

    export const delConnCnt = (chain: string, pid: IDT) => {
        delete ConnCntMap[chain][pid]
    }

    export const getConnCnt = (chain: string, pid: IDT): number => {
        if (!ConnCntMap[chain] || !ConnCntMap[chain][pid]) {
            return 0
        }
        return ConnCntMap[chain][pid]
    }

    // 
    export const addSubReqMap = (subsId: string, id: IDT) => {
        if (SubMap[subsId]) {
            log.error(`add new subscribe map error: subscribe ID exist`)
            process.exit(2)
        }
        SubMap[subsId] = id
        log.debug(`add new subscribe Id map: ${subsId}`)
    }

    export const getReqId = (subsId: string): ResultT<IDT> => {
        if (!SubMap[subsId]) {
            return Err(`No this request, subscription ${subsId}`)
        }
        return Ok(SubMap[subsId])
    }

    export const delSubReqMap = (subsId: string): void => {
        delete SubMap[subsId]
        log.debug(`delete subscribe Id map: ${subsId}`)
    }

    export const getSubReqMap = () => {
        return SubMap || {}
    }

    // 
    export const addReqCache = (req: ReqT): void => {
        if (ReqMap[req.id]) {
            log.error(`add new request cache error: ${req.id} exist`)
            process.exit(2)
        }
        ReqMap[req.id] = req
    }

    export const updateReqCache = (req: ReqT): void => {
        ReqMap[req.id] = req
    }

    export const delReqCache = (reqId: IDT): void => {
        delete ReqMap[reqId]
    }

    export const getReqCache = (reqId: IDT): ResultT<ReqT> => {
        if (!ReqMap[reqId]) {
            return Err(`invalid request id ${reqId}`)
        }
        return Ok(ReqMap[reqId])
    }

    export const getAllReqCache = () => {
        return ReqMap
    }

    export const addSubTopic = (chain: string, pid: IDT, topic: SubscripT): void => {
        const key = `${chain}-${pid}`

        TopicSubed[key] = TopicSubed[key] || {}
        TopicSubed[key][topic.id] = topic
    }

    export const remSubTopic = (chain: string, pid: IDT, subsId: string): void => {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key]) return

        delete TopicSubed[key][subsId]
        if (Object.keys(TopicSubed[key]).length == 0) {
            delete TopicSubed[key]
        }
    }

    export const getSubTopic = (chain: string, pid: IDT, subsId: IDT): ResultT<SubscripT> => {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key] || !TopicSubed[key][subsId]) {
            return Err(`Invalid subscribed topic: chain ${chain} pid[${pid} id[${subsId}]`)
        }
        return Ok(TopicSubed[key][subsId])
    }

    export const getSubTopics = (chain: string, pid: IDT): SubscripMap => {
        const key = `${chain}-${pid}`
        if (!TopicSubed[key]) {
            return {}
        }
        return TopicSubed[key]
    }

    export const getAllSubTopics = (): TopicSubedT => {
        return TopicSubed
    }

}

export default G