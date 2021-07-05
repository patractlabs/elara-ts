import Http from 'http'
import { getAppLogger } from "../../lib"

const log = getAppLogger('dispatcher', true)


import Suducer from "./pusumer/suducer"
import Matcher from "./pusumer/matcher"
import Pusumer from './pusumer'
// import History from "./pusumer/history"

enum RpcTyp {
    Suducer = 'suducer',
    Matcher = 'matcher',
    History = 'history',
    Direct  = 'direct'
}

const getRpcType = (method: string, params: any[]): RpcTyp => {
    if (params.length === 0 && Suducer.Rpcs.includes(method)) { 
        return RpcTyp.Suducer
    }
    if (Matcher.Rpcs.includes(method)) { return RpcTyp.Matcher }
    // if (History.Rpcs.includes(method)) { return RpcTyp.History }
    return RpcTyp.Direct
}

const handleWs = () => {

}

const handleRpc = () => {

}

export const dispatchRpc = (chain: string, method: string, params: any[], resp: Http.ServerResponse) => {
    const typ = getRpcType(method, params)
    log.info(`new rpc request ${method} of chain ${chain}: ${typ}`)
    switch (typ) {
        case RpcTyp.Suducer:
            break
        case RpcTyp.Matcher:
            break
        case RpcTyp.History:
            break
        case RpcTyp.Direct:
            break
    }

}

export const dispatchWs = (chain: string, method: string, params: any[], pusumer: Pusumer) => {
    const typ = getRpcType(method, params)
    log.info(`new ws request ${method} of chain ${chain}: ${typ}`)
    
}