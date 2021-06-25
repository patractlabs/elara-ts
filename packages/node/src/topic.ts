
const subpair: {[key in string]: string} = {
    chain_subscribeAllHeads: "chain_unsubscribeAllHeads",          
    chain_subscribeFinalisedHeads: "chain_unsubscribeFinalisedHeads",   
    chain_subscribeFinalizedHeads: "chain_unsubscribeFinalizedHeads", 
    chain_subscribeNewHead: "chain_unsubscribeNewHead",  
    chain_subscribeNewHeads: "chain_unsubscribeNewHeads",     
    chain_subscribeRuntimeVersion: "chain_unsubscribeRuntimeVersion",
    grandpa_subscribeJustifications: "grandpa_unsubscribeJustifications",  

    state_subscribeRuntimeVersion: "state_unsubscribeRuntimeVersion",  
    state_subscribeStorage: "state_unsubscribeStorage",     
    author_submitAndWatchExtrinsic: "author_unwatchExtrinsic",  

    subscribe_newHead: "unsubscribe_newHead"              
}

namespace Topic {
    export const subscribe = [
        "chain_subscribeAllHeads",          // chain_allHead
        "chain_subscribeFinalisedHeads",    // chain_finalizedHead
        "chain_subscribeFinalizedHeads",    // chain_finalizedHead
        "chain_subscribeNewHead",           // chain_newHead
        "chain_subscribeNewHeads",          // chain_newHead
        "chain_subscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_subscribeJustifications",  // grandpa_justifications

        "state_subscribeRuntimeVersion",    // state_runtimeVersion
        "state_subscribeStorage",           // state_storage
        "author_submitAndWatchExtrinsic",   // ?
    
        "subscribe_newHead"                 // chain_newHead
    ]

    export const unsubscribe = [
        "chain_unsubscribeAllHeads",          // chain_allHead
        "chain_unsubscribeFinalisedHeads",    // chain_finalizedHead
        "chain_nusubscribeFinalizedHeads",    // chain_finalizedHead
        "chain_unsubscribeNewHead",           // chain_newHead
        "chain_unsubscribeNewHeads",          // chain_newHead
        "chain_unsubscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_unsubscribeJustifications",  // grandpa_justifications

        "state_unsubscribeRuntimeVersion",    // state_runtimeVersion
        "state_unsubscribeStorage",           // state_storage
        "author_unwatchExtrinsic",   // ?
    
        "unsubscribe_newHead"                 // chain_newHead
    ]

    export const getUnsub = (topic: string): string => {
        return subpair[topic]
    }
}

export default Topic