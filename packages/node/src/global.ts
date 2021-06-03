import { Err, Ok, getAppLogger, IDT, ResultT, RpcMethods, RpcMethodT } from 'lib'
import { Suber, Puber, SuberMap, PuberMap, ChainSuber, MatcherT, Matcher } from './interface'

const log = getAppLogger('G', true)
type PidTopicMap = { [key in string]: string[] }

const Subers: ChainSuber = {}
const Pubers: PuberMap = {}
const Matchers: {[key in string]: MatcherT} = {}     // pubId: Matcher
const TopicSubed: { [key in string]: PidTopicMap } = {} // {chain: {pid: []}}
const Chains: string[] = []
const Rpcs: RpcMethodT = RpcMethods
const SubCache: {[key in string]: IDT} = {} // subscriptionId to pubId

let ID_CNT: number = 0

const ldel = (lis: any[], value: any) => {
    return lis.filter((val) => {
        return val !== value
    })
}

namespace G {

    export const getID = (): number => {
        return ID_CNT++
    }

    export const getSuber = (chain: string, subId: IDT): ResultT => {
        chain = chain.toLowerCase()
        if (!Subers[chain] || !Subers[chain][subId]) {
            return Err(`No this suber`)
        }
        return Ok(Subers[chain][subId])
    }

    export const getChainSubers = (chain: string): SuberMap => {
        return Subers[chain.toLowerCase()] || {}
    }

    export const getAllSubers = (): ChainSuber => {
        return Subers
    }

    export const addSuber = (chain: string, suber: Suber): void => {
        chain = chain.toLowerCase()
        const sub: SuberMap = {}
        sub[suber.id] = suber
        Subers[chain] = {
            ...Subers[chain],
            ...sub
        }
    }

    export const delSuber = (chain: string, subId: IDT): void => {
        chain = chain.toLowerCase()
        delete Subers[chain][subId]
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
        Pubers[puber.id] = puber
    }

    export const delPuber = (pubId: IDT): void => {
        delete Pubers[pubId]
    }

    export const addMatcher = (pubId: IDT, subId: IDT, options?: MatcherT): void => {
        Matchers[pubId] = {
            ...options,
            subId,
            pubId
        }
    }

    export const getMatcher = (pubId: IDT): MatcherT => {
        return Matchers[pubId]
    }

    export const updateMatcher = (pubId: IDT, matcher: MatcherT): void => {
        Matchers[pubId] = {
            ...Matchers[pubId],
            ...matcher
        }
    }

    export const delMatcher = (pubId: IDT): void => {
        delete Matchers[pubId]
    }

    export const getSubId = (pubId: IDT): ResultT => {
        if (!Matchers[pubId]) {
            return Err('No this mathcer')
        }
        return Ok(Matchers[pubId].subId)
    }

    export const addSubTopic = (chain: string, pid: IDT, topic: string): void => {
        chain = chain.toLowerCase()
        if (TopicSubed[chain] && TopicSubed[chain][pid]) {
            TopicSubed[chain][pid].push(topic)
            return
        }

        if (!TopicSubed[chain]) {
            TopicSubed[chain] = {}
        }

        const tops: PidTopicMap = {}
        tops[pid] = [topic]
        
        TopicSubed[chain] = {
            ...TopicSubed[chain],
            ...tops
        }
    }

    export const remSubTopic = (chain: string, pid: IDT, topic: string): void => {
        chain = chain.toLowerCase()
        const news = ldel(TopicSubed[chain][pid], topic)
        TopicSubed[chain][pid] = news
    }

    export const getSubTopics = (chain: string, pid: IDT): string[] => {
        chain = chain.toLowerCase()
        if (!TopicSubed[chain] || !TopicSubed[chain][pid]) {
            return []
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
        chain = chain.toLowerCase()
        if (Chains.indexOf(chain) !== -1)  {
            log.warn('Chain is exist: ', chain)
            return
        }
        Chains.push(chain)
    }

    export const remChain = (chain: string): void => {
        ldel(Chains, chain)
    }

    export const getChains = (): string[] => {
        return Chains
    }

    export const getRpcMap = (): RpcMethodT => {
        return Rpcs
    }

    export const addSubCache = (subscriptId: string, id: IDT) => {
        SubCache[subscriptId] = id
    }

    export const getSubCache = (subscriptId: string): ResultT => {
        if (!SubCache[subscriptId]) {
            return Err('No this subscription')
        }
        return Ok(SubCache[subscriptId])
    }

    export const delSubCache = (subscriptId: string): void => {
        delete SubCache[subscriptId]
    }
}

export = G