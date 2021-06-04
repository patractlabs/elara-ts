import { Err, Ok, getAppLogger, IDT, ResultT, RpcMethods, RpcMethodT } from 'lib'
import { Suber, Puber, SuberMap, PuberMap, ChainSuber, MatcherT, SubscripT, SubscripMap } from './interface'
import Matcher from './matcher'

const log = getAppLogger('G', true)

type PidTopicMap = { [key in string]: SubscripMap }

const Subers: ChainSuber = {}
const Pubers: PuberMap = {}
const Matchers: {[key in string]: MatcherT} = {}     // pubId: Matcher
const TopicSubed: { [key in string]: PidTopicMap } = {} // {chain: {pid: {}}}
const Chains: string[] = []
const Rpcs: RpcMethodT = RpcMethods
const SubCache: {[key in string]: IDT} = {} // subscriptionId to pubId
const MethodCache: {[key in string]: SubscripT } = {}  // pubId: {}

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
        let subscribe: string[] = Matchers[pubId].subscribe || []
        if (matcher.subscribe) {
            subscribe.push(...matcher.subscribe)
        }
        Matchers[pubId] = {
            ...Matchers[pubId],
            ...matcher,
            subscribe
        }
    }

    export const delMatcher = (pubId: IDT): void => {
        delete Matchers[pubId]
    }

    export const addMatcherSub = (pubId: IDT, subsId: string): void => {
        Matchers[pubId].subscribe?.push(subsId)
    }

    export const remMatcherSub = (pubId: IDT, subsId: string): void => {
        const newSubs = ldel(Matchers[pubId].subscribe!, subsId)
        Matchers[pubId].subscribe = newSubs
    }

    export const getSubId = (pubId: IDT): ResultT => {
        if (!Matchers[pubId]) {
            return Err('No this mathcer')
        }
        return Ok(Matchers[pubId].subId)
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

    /// subscribe id - pubId map
    export const addSubscription = (subscriptId: string, id: IDT) => {
        SubCache[subscriptId] = id
    }

    export const getSubscription = (subscriptId: string): ResultT => {
        if (!SubCache[subscriptId]) {
            return Err('No this subscription')
        }
        return Ok(SubCache[subscriptId])
    }

    export const delSubscription = (subscriptId: string): void => {
        delete SubCache[subscriptId]
    }

    // method cacche for subscribe method map
    export const addMethodCache = (pubId: IDT, topic: string, params: string): void => {
        MethodCache[pubId] = {topic, params, pubId}
    }

    export const delMethodCache = (pubId: IDT): void => {
        delete MethodCache[pubId]
    }

    export const getMethodCache = (pubId: IDT): ResultT => {
        if (!MethodCache[pubId]) {
            return Err('')
        }
        return Ok(MethodCache[pubId])
    }
}

export = G