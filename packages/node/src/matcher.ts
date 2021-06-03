/// manager ws socket pair 
/// TODO
/// 1. dapps fail
///     - part connectin fail, regist matcher to valid connection
///     - all fail, clear all matcher bind to this dapp

/// 2. elara fail
///     - all connection fail, need dapps to reconnect
/// 3. node fail
///     - node recover in soon(e.g. 10s), keep the puber connection, regist matchers
///     - node fail longtime, clear all pubers and matchers



import { IDT, getAppLogger, Err, Ok, ResultT, isOk, isErr, Result } from 'lib'
import G from './global'
import { Matcher, MatcherT, WsData } from './interface'

const log = getAppLogger('matcher', true)

const selectSuber = (chain: string): ResultT => {
    
    const subers = G.getChainSubers(chain)
    const keys = Object.keys(subers)
    if (!keys || keys.length < 1) {
        log.error('Select suber error: no valid subers of chain ', chain)
        return Err(`No valid suber of chain[${chain}]`)
    }
    const ind = G.getID() % keys.length
    log.warn('Select the suber: ', ind, keys[ind])
    return Ok(keys[ind])
}

namespace Matcher {
    export const regist = (pubId: IDT, chain: string): ResultT => {
        const re = selectSuber(chain)
        if (isOk(re)) { 
            G.addMatcher(pubId, re.value, {chain}) 
        }
        return re
    }

    export const unRegist = (pubId: IDT): void => {
        G.delMatcher(pubId)
    }

    export const get = (pubId: IDT): ResultT => {
        const matcher = G.getMatcher(pubId)
        if (!matcher) {
            return Err(`No this matcher-${pubId}`)
        }
        return Ok(matcher)
    }

    export const update = (pubId: IDT, matcher: MatcherT): void => {
        G.updateMatcher(pubId, matcher)
    }

    export const getOriginId = (pubId: IDT): ResultT => {
        const re = get(pubId)
        if (isErr(re)) {
            return re
        }
        const matcher = re.value as MatcherT
        return Ok(matcher.originId)
    }

    export const isSubscribed = (pubId: IDT, data: WsData): boolean => {
        const re = get(pubId)
        if (isErr(re)) { 
            // SBH
            log.error('Cannot be here!')
            return false 
        }
        const matcher = re.value as MatcherT
        const topic = data.method
        const params = data.params
        
        return true
    }
}

export default Matcher