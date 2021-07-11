import { getAppLogger, IDT } from "lib"
import { ResultT, Err, Ok, Option, None, Some} from "lib"
import { ReqT } from "./interface"
import { ChainSuber, SuberMap } from "./interface"
import Suber, { SuberTyp,  } from "./matcher/suber"
const log = getAppLogger('global')
// subscribe type
export interface SubscripT {
    id: string,
    pubId: IDT,
    method: string,
    params: any[]
}
export type SubscripMap = { [key in string]: SubscripT }
type TopicSubedT = { [key in string]: SubscripMap }
const TopicSubed: TopicSubedT = {}

const SubMap: { [key in string]: IDT } = {}

export type ReqMap = { [key in string]: ReqT }
const ReqMap: ReqMap = {}

let ID_CNT: number = 0

const TryCntMap: { [key in string]: number } = {}
const ConnCntMap: { [key in string]: { [key in string]: number } } = {}

const Subers: ChainSuber = {}


namespace G {

    export const getSuber = (chain: string, type: SuberTyp, subId: IDT): Option<Suber> => {
        const ct = `${chain}-${type}`
        // log.debug(`get suber: ${Subers[ct]}, ${!Subers[ct]}, ${Subers[ct][subId]}, ${!Subers[ct][subId]}`)
        if (!Subers[ct] || !Subers[ct][subId]) {
            return None
        }
        return Some(Subers[ct][subId])
    }

    export const getSubersByChain = (chain: string, type: SuberTyp,): SuberMap => {
        const ct = `${chain}-${type}`
        return Subers[ct] || {}
    }

    export const getAllSuber = (): ChainSuber => {
        return Subers
    }

    export const updateOrAddSuber = (chain: string, type: SuberTyp, suber: Suber): void => {
        const ct = `${chain}-${type}`
        Subers[ct] = Subers[ct] || {}
        Subers[ct][suber.id] = suber
        log.debug(`updateOradd ${chain} ${type} suber[${suber.id}] pubers: `, Subers[ct][suber.id].pubers)
    }

    export const delSuber = (chain: string, type: SuberTyp, subId: IDT): void => {
        const ct = `${chain}-${type}`
        // Subers[ct][subId].pubers?.clear()    // BUG: will clear other  suber's pubers
        delete Subers[ct][subId]
        log.debug(`delete ${chain} ${type} suber[${subId}] result: `, Subers[ct][subId] === undefined)
    }

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
    export const addSubReqMap = (subscriptId: string, id: IDT) => {
        if (SubMap[subscriptId]) {
            log.error(`add new subscribe map error: subscribe ID exist`)
            process.exit(2)
        }
        SubMap[subscriptId] = id
    }

    export const getReqId = (subsId: string): ResultT<IDT> => {
        if (!SubMap[subsId]) {
            return Err(`No this request, subscription ${subsId}`)
        }
        return Ok(SubMap[subsId])
    }

    export const delSubReqMap = (subsId: string): void => {
        delete SubMap[subsId]
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