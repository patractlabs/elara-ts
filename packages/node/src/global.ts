import { Err, Ok, getAppLogger, IDT, ResultT, RpcMethods, RpcMethodT } from 'lib'
import { SuberMap, PuberMap, ChainSuber, SubscripT, SubscripMap, ReqMap, ReqT } from './interface'
import Suber from './suber'
import Puber from './puber'

const log = getAppLogger('G', true)

type PidTopicMap = { [key in string]: SubscripMap }

/**
 * Subers {
 *  'polkadot': {
 *      'f90dc072e006d5f6f8fbe33e565d274f': {
 *          id: 'f90dc072e006d5f6f8fbe33e565d274f',
 *          url: '127.0.0.1:9944',
 *          chain: 'polkadot',
 *          ws: WebSocketObject,
 *          pubers: ['852c5949c10b2797dedad388fa745110']
 *       }
 *   }
 * }
 */
const Subers: ChainSuber = {}

/**
 * Pubers {
 *  '852c5949c10b2797dedad388fa745110': {
 *      id: '852c5949c10b2797dedad388fa745110',
 *      pid: 'dfaghlsjflslajslkgslgjklj',
 *      chain: 'polkadot',
 *      originId: 1,
 *      ws: WebSocketObject
 *      subId: 'f90dc072e006d5f6f8fbe33e565d274f',
 *      topics: ['subsID']
 *  }
 * }
 */
const Pubers: PuberMap = {}

/**
 * ToppicSubed {
 *  'polkadot': {
 *      'dfaghlsjflslajslkgslgjklj': {
 *          id: 'sdfi23kjldsfds32',
 *          method: 'chain_subscribeNewHead',
 *          pubId: 'fkjskljxjglksdjsdgjsg',
 *          params: '[]'
 *      }
 *  }
 * }
 */
type TopicSubedT = { [key in string]: PidTopicMap }
const TopicSubed: TopicSubedT = {} 

let Chains: Set<string> = new Set()
const Rpcs: RpcMethodT = RpcMethods
const ReqMap: ReqMap = {}
const SubMap: {[key in string]: IDT} = {} // subscriptionId to reqId

const TryCntMap: {[key in string]: number} = {}
const ConnCntMap: {[key in string]: {[key in string]: number}} = {}

let ID_CNT: number = 0      // for suber select factor

namespace G {

    export const getID = (): number => {
        return ID_CNT++
    }

    export const getSuber = (chain: string, subId: IDT): ResultT => {
        chain = chain.toLowerCase()
        if (!Subers[chain] || !Subers[chain][subId]) {
            return Err(`No this suber ${subId} of ${chain}`)
        }
        return Ok(Subers[chain][subId])
    }

    export const getChainSubers = (chain: string): SuberMap => {
        return Subers[chain.toLowerCase()] || {}
    }

    export const getAllSubers = (): ChainSuber => {
        return Subers
    }

    export const updateAddSuber = (chain: string, suber: Suber): void => {
        chain = chain.toLowerCase()
        const sub: SuberMap = {}
        // log.warn('subers before add: ', Subers[chain])
        sub[suber.id] = suber
        Subers[chain] = {
            ...Subers[chain],
            ...sub
        }
        // log.warn('subers after add: ', Subers[chain])
    }

    export const delSuber = (chain: string, subId: IDT): void => {
        // log.warn('subers before delete: ', Subers[chain])
        chain = chain.toLowerCase()
        Subers[chain][subId].pubers?.clear()
        delete Subers[chain][subId]
        // log.warn('subers after delete: ', Subers[chain])
    }

    export const getPuber = (pubId: IDT): ResultT => {
        if (!Pubers[pubId]) {
            return Err(`No puber [${pubId}]`)
        }
        return Ok(Pubers[pubId])
    }

    export const getPubers = (): PuberMap => {
        return Pubers
    }

    export const updateAddPuber = (puber: Puber): void => {
        // log.warn('pubers before add: ', Pubers)
        Pubers[puber.id] = puber
        // log.warn('pubers after add: ', Pubers)
    }

    export const delPuber = (pubId: IDT): void => {
        // log.warn('pubers before delete: ', Pubers)
        Pubers[pubId].topics?.clear()
        delete Pubers[pubId]
        // log.warn('pubers after delete: ', Pubers)
    }

    export const updateAddReqCache = (req: ReqT): void => {
        // log.warn('request cache before add-update: ', ReqMap)
        ReqMap[req.id] = req
        // log.warn('request cache after add-update: ', ReqMap)
    }

    export const delReqCache = (reqId: IDT): void => {
        // log.warn('request cache before del: ', ReqMap)
        delete ReqMap[reqId]
        // log.warn('request cache after del: ', ReqMap)
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
        // log.info('Into add sub topic: ', chain, pid, topic)
        chain = chain.toLowerCase()
        const newSub: SubscripMap = {}
        newSub[topic.id!] = topic

        if (TopicSubed[chain] && TopicSubed[chain][pid]) {
            
            TopicSubed[chain][pid] = {
                ...TopicSubed[chain][pid],
                ...newSub
            }
            // log.warn('after add sub topic: ', JSON.stringify(TopicSubed))
            return
        }

        if (!TopicSubed[chain]) {
            TopicSubed[chain] = {}
        }

        const tops: PidTopicMap = {}
        tops[pid] = newSub
        
        TopicSubed[chain] = {
            ...TopicSubed[chain],
            ...tops
        }
        
        // log.warn('after add sub topic: ', JSON.stringify(TopicSubed))
    }

    export const remSubTopic = (chain: string, pid: IDT, subsId: string): void => {
        // log.warn(`Subscribed topics before delete: `, TopicSubed[chain][pid])
        chain = chain.toLowerCase()
        delete TopicSubed[chain][pid][subsId] 
        // log.warn(`Subscribed topics after delete: `, TopicSubed[chain][pid])

    }

    export const getSubTopic = (chain: string, pid: IDT, subsId: IDT): ResultT => {
        const ct = TopicSubed[chain]
        if (!ct || !ct[pid] || !ct[pid][subsId]) {
            return Err(`Invalid subscribed topic: ${subsId}`)
        }
        return Ok(TopicSubed[chain][pid][subsId])
    }

    export const getSubTopics = (chain: string, pid: IDT): SubscripMap => {
        chain = chain.toLowerCase()
        if (!TopicSubed[chain] || !TopicSubed[chain][pid]) {
            return {}
        }
        return TopicSubed[chain][pid]
    }

    export const getSubTopicsByChain = (chain: string): PidTopicMap => {
        return TopicSubed[chain] || {}
    }

    export const getAllSubTopics = (): TopicSubedT => {
        return TopicSubed
    }

    export const initChains = (chains: Set<string>): void => {
        Chains = new Set([...Chains, ...chains])
    }

    export const addChain = (chain: string): void => {
        // log.warn('chains before add: ', Chains)
        chain = chain.toLowerCase()
        if (Chains.has(chain))  {
            log.warn('Chain is exist: ', chain)
            return
        }
        Chains.add(chain)
        // log.warn('chains after add: ', Chains)
    }

    export const remChain = (chain: string): void => {
        // log.warn('chains before remove: ', Chains)
        Chains.delete(chain)
        // log.warn('chains after remove: ', Chains)
    }

    export const getChains = (): Set<string> => {
        return Chains
    }

    export const updateChains = (chains: Set<string>) => {
        Chains = chains
    }

    export const getRpcMap = (): RpcMethodT => {
        return Rpcs
    }

    /// subscribe id - req id map
    export const addSubReqMap = (subscriptId: string, id: IDT) => {
        SubMap[subscriptId] = id
    }

    export const getReqId = (subscriptId: string): ResultT => {
        if (!SubMap[subscriptId]) {
            return Err(`No this subscription ${subscriptId}`)
        }
        return Ok(SubMap[subscriptId])
    }

    export const delSubReqMap = (subscriptId: string): void => {
        // log.warn(`SubMap before delete: `, SubMap)
        delete SubMap[subscriptId]
        // log.warn(`SubMap after delete: `, SubMap)
    }

    export const resetConnCnt = (chain: string) => {
        TryCntMap[chain] = 0
    }

    export const incrTryCnt = (chain: string) => {
        TryCntMap[chain] = 1 + TryCntMap[chain] || 0
    }

    export const getTryCnt = (chain: string) => {
        return TryCntMap[chain] || 0
    }

    export const incrConnCnt = (chain: string, pid: IDT) => {
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


    // for test
    export const puberCnt = (): number => {
        return Object.keys(Pubers).length
    }

    export const puberTopicCnt = (pubId: IDT): number => {
        return Pubers[pubId].topics?.size || 0
    }

    export const suberCnt = (): number => {
        let cnt = 0
        for (let c in Subers) {
            cnt += Object.keys(Subers[c]).length
        }
        return cnt
    }

    export const suberPuberCnt = (chain: string, subId: IDT): number => {
        return Subers[chain][subId].pubers?.size || 0
    }

    export const topicCnt = (): number => {
        let cnt = 0
        for (let c in TopicSubed) {
            for (let p in TopicSubed[c]) {
                cnt += Object.keys(TopicSubed[c][p]).length
            }
        }
        return cnt
    }

    export const subMapCnt = (): number => {
        return Object.keys(SubMap).length
    }

    export const reqMapCnt = (): number => {
        return Object.keys(ReqMap).length
    }

    export const stat = (): string => {
        return `
        suber: ${suberCnt()}
        puber: ${Object.keys(Pubers).length}
        subTopic: ${topicCnt()}
        subMap: ${Object.keys(SubMap).length}
        reqMap: ${Object.keys(ReqMap).length}`
    }
}

export = G