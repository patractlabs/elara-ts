import { getAppLogger } from 'lib'
import Dao from '../dao'

const log = getAppLogger('suducer', true)



const sendCache = async (chain: string, method: string) => {
    log.info(`new sudecer cache request, chain ${chain} method[${method}]`)
    return Dao.getChainCache(chain, method)
}

const sendSub = async (chain: string, topic: string) => {
    log.info(`new sudecer subscribe request, chain ${chain} method[${topic}]`)
    return 
}


namespace Suducer {
    export const Rpcs = [
        // subscribe
        "chain_subscribeAllHeads",
        "chain_subscribeNewHeads", 
        "chain_subscribeFinalizedHeads", 
        "state_subscribeRuntimeVersion",   
        "state_subscribeStorage", 
        "grandpa_subscribeJustifications",
    
        // sync when block update
        "system_syncState",
        "system_health",
        "chain_getHeader",
        "chain_getBlock",
        "chain_getBlockHash",
        "chain_getFinalizedHead",
    
        // sync once
        "rpc_methods",
        "system_version",
        "system_chain",
        "system_chainType",
        "system_properties",
        "state_getMetadata" 
    ]

    export const isSub = (method: string): boolean => {
        return method.includes('sub')
    }

    export const send = async (chain: string, method: string, params: any[]) => {
        log.info(`new suducer request chain ${chain} method ${method} params ${params}`)
        if (isSub(method)) {
            return sendSub(chain, method)
        } else {
            return sendCache(chain, method)
        }
    }
}


export default Suducer