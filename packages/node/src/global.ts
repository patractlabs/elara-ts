import { Err, Ok, getAppLogger, IDT, ResultT, RpcMethods, RpcMethodT } from 'lib'
import { SuberMap, PuberMap, ChainSuber, SubscripT, SubscripMap, ReqMap, WsData, ReqT } from './interface'
import Suber from './suber'
import Puber from './puber'
import Util from './util'

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
 *      topics: ['chain_subscribeNewHead']
 *  }
 * }
 */
const Pubers: PuberMap = {}

/**
 * Top{
 *  'polkadot': {
 *      'dfaghlsjflslajslkgslgjklj': {
 *          id: 'sdfi23kjldsfds32',
 *          topic: 'chain_subscribeNewHead',
 *          pubId: 'fkjskljxjglksdjsdgjsg',
 *          params: '[]'
 *      }
 *  }
 * }
 */
const TopicSubed: { [key in string]: PidTopicMap } = {} 

let Chains: string[] = []
const Rpcs: RpcMethodT = RpcMethods
const ReqMap: ReqMap = {}

const SubMap: {[key in string]: IDT} = {} // subscriptionId to reqId
const TopicCache: {[key in string]: SubscripT } = {}  // pubId: {}

let ID_CNT: number = 0

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
        log.warn('subers before add: ', Subers[chain])
        sub[suber.id] = suber
        Subers[chain] = {
            ...Subers[chain],
            ...sub
        }
        log.warn('subers after add: ', Subers[chain])
    }

    export const delSuber = (chain: string, subId: IDT): void => {
        log.warn('subers before delete: ', Subers[chain])
        chain = chain.toLowerCase()
        delete Subers[chain][subId]
        log.warn('subers after delete: ', Subers[chain])
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

    export const addPuber = (puber: Puber): void => {
        log.warn('pubers before add: ', Pubers)
        Pubers[puber.id] = puber
        log.warn('pubers after add: ', Pubers)
    }

    export const delPuber = (pubId: IDT): void => {
        log.warn('pubers before delete: ', Pubers)
        delete Pubers[pubId]
        log.warn('pubers after delete: ', Pubers)
    }

    export const updateAddReqCache = (req: ReqT): void => {
        log.warn('request cache before add-update: ', ReqMap)
        ReqMap[req.id] = req
        log.warn('request cache after add-update: ', ReqMap)
    }

    export const delReqCache = (reqId: IDT): void => {
        log.warn('request cache before del: ', ReqMap)
        delete ReqMap[reqId]
        log.warn('request cache after del: ', ReqMap)
    }

    export const getReqCache = (reqId: IDT): ResultT => {
        if (!ReqMap[reqId]) {
            return Err(`invalid request id ${reqId}`)
        }
        return Ok(ReqMap[reqId])
    }

    export const addSubTopic = (chain: string, pid: IDT, topic: SubscripT): void => {
        log.info('Into add sub topic: ', chain, pid, topic)
        chain = chain.toLowerCase()
        const newSub: SubscripMap = {}
        newSub[topic.id!] = topic

        if (TopicSubed[chain] && TopicSubed[chain][pid]) {
            
            TopicSubed[chain][pid] = {
                ...TopicSubed[chain][pid],
                ...newSub
            }
            log.warn('after add sub topic: ', JSON.stringify(TopicSubed[chain][pid]))

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
        log.warn('after add sub topic: ', JSON.stringify(TopicSubed[chain][pid]))
    }

    export const remSubTopic = (chain: string, pid: IDT, subsId: string): void => {
        chain = chain.toLowerCase()
        delete TopicSubed[chain][pid][subsId] 
    }

    export const getSubTopics = (chain: string, pid: IDT): SubscripMap => {
        chain = chain.toLowerCase()
        if (!TopicSubed[chain] || !TopicSubed[chain][pid]) {
            return {}
        }
        return TopicSubed[chain][pid]
    }

    export const getSubTopicsByChain = (chain: string): PidTopicMap => {
        return TopicSubed[chain]
    }

    export const getAllSubTopics = () => {
        return TopicSubed
    }

    export const initChains = (chains: string[]): void => {
        Chains.push(...chains)
    }

    export const addChain = (chain: string): void => {
        log.warn('chains before add: ', Chains)
        chain = chain.toLowerCase()
        if (Chains.indexOf(chain) !== -1)  {
            log.warn('Chain is exist: ', chain)
            return
        }
        Chains.push(chain)
        log.warn('chains after add: ', Chains)
    }

    export const remChain = (chain: string): void => {
        log.warn('chains before remove: ', Chains)
        const news = Util.ldel(Chains, chain)
        Chains = news
        log.warn('chains after remove: ', Chains)
    }

    export const getChains = (): string[] => {
        return Chains
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
        delete SubMap[subscriptId]
    }

    export const delTopicCache = (pubId: IDT): void => {
        delete TopicCache[pubId]
    }

    export const getTopicCache = (pubId: IDT): SubscripT => {
        return TopicCache[pubId]
    }
}

export = G