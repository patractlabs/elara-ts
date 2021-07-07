import { getAppLogger, IDT } from "lib"
import { ResultT, Err, Ok } from "lib"
import { ReqT } from "./interface"
const log = getAppLogger('global', true)
// subscribe type
export interface SubscripT {
    id: string,
    pubId: IDT,
    method: string,
    params: string
}
export type SubscripMap = {[key in string]: SubscripT}
type TopicSubedT = { [key in string]: SubscripMap }
const TopicSubed: TopicSubedT = {} 

const SubMap: {[key in string]: IDT} = {}

export type ReqMap = {[key in string]: ReqT}
const ReqMap: ReqMap = {}

let ID_CNT: number = 0

const TryCntMap: {[key in string]: number} = {}

namespace G {
    export const getID = (): number => {
        return ID_CNT++
    }

    export const resetConnCnt = (chain: string) => {
        chain = chain.toLowerCase()
        TryCntMap[chain] = 0
    }

    export const incrTryCnt = (chain: string) => {
        chain = chain.toLowerCase()
        TryCntMap[chain] = 1 + TryCntMap[chain] || 0
    }

    export const getTryCnt = (chain: string) => {
        chain = chain.toLowerCase()
        return TryCntMap[chain] || 0
    }

    // 
    export const addSubReqMap = (subscriptId: string, id: IDT) => {
        if (SubMap[subscriptId]) {
            log.error(`add new subscribe map error: subscribe ID exist`)
            process.exit(2)
        }
        SubMap[subscriptId] = id
    }

    export const getReqId = (subsId: string): ResultT => {
        if (!SubMap[subsId]) {
            return Err(`No this request, subscription ${subsId}`)
        }
        return Ok(SubMap[subsId])
    }

    export const delSubReqMap = (subscriptId: string): void => {
        delete SubMap[subscriptId]
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

    export const getReqCache = (reqId: IDT): ResultT => {
        if (!ReqMap[reqId]) {
            return Err(`invalid request id ${reqId}`)
        }
        return Ok(ReqMap[reqId])
    }

    export const getAllReqCache = () => {
        return ReqMap
    }

    export const addSubTopic = (chain: string, pid: IDT, topic: SubscripT): void => {
        const key = `${chain.toLowerCase()}-${pid}`
        const newSub: SubscripMap = {}
        newSub[topic.id!] = topic

        TopicSubed[key] = {
            ...TopicSubed[key],
            ...newSub
        }
    }

    export const remSubTopic = (chain: string, pid: IDT, subsId: string): void => {
        chain = chain.toLowerCase()
        const key = `${chain}-${pid}`
        if (!TopicSubed[key]) return
        
        delete TopicSubed[key][subsId] 
        if (Object.keys(TopicSubed[key])) {
            delete TopicSubed[key]
        }
    }

    export const getSubTopic = (chain: string, pid: IDT, subsId: IDT): ResultT => {
        const key = `${chain.toLowerCase()}-${pid}`
        if (!TopicSubed[key] || !TopicSubed[key][subsId]) {
            return Err(`Invalid subscribed topic: chain ${chain} pid[${pid} id[${subsId}]`)
        }
        return Ok(TopicSubed[key][subsId])
    }

    export const getSubTopics = (chain: string, pid: IDT): SubscripMap => {
        chain = chain.toLowerCase()
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