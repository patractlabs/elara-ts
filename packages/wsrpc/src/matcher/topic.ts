
const subpair: { [key in string]: string } = {
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

class Topic {
    static subscribe = [
        "chain_subscribeAllHeads",          // chain_allHead
        "chain_subscribeFinalisedHeads",    // chain_finalizedHead
        "chain_subscribeFinalizedHeads",    // chain_finalizedHead
        "chain_subscribeNewHead",           // chain_newHead
        "chain_subscribeNewHeads",          // chain_newHead
        "chain_subscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_subscribeJustifications",  // grandpa_justifications

        "state_subscribeRuntimeVersion",    // state_runtimeVersion
        "state_subscribeStorage",           // state_storage
        "author_submitAndWatchExtrinsic",   // author_extrinsicUpdate

        "subscribe_newHead"                 // chain_newHead
    ]

    static unsubscribe = [
        "chain_unsubscribeAllHeads",          // chain_allHead
        "chain_unsubscribeFinalisedHeads",    // chain_finalizedHead
        "chain_nusubscribeFinalizedHeads",    // chain_finalizedHead
        "chain_unsubscribeNewHead",           // chain_newHead
        "chain_unsubscribeNewHeads",          // chain_newHead
        "chain_unsubscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_unsubscribeJustifications",  // grandpa_justifications

        "state_unsubscribeRuntimeVersion",    // state_runtimeVersion
        "state_unsubscribeStorage",           // state_storage
        "author_unwatchExtrinsic",            // author_extrinsicUpdate

        "unsubscribe_newHead"                 // chain_newHead
    ]

    static getUnsub = (topic: string): string => {
        return subpair[topic]
    }
}

export const UnsafeMethods = new Set([
    // export sensitive info
    'system_nodeRoles',
    'system_localListenAddresses',
    'system_localPeerId',

    // change the chain data
    'system_addLogFilter',
    'system_resetLogFilter',
    'system_addReservedPeer',
    'system_removeReservedPeer',

    'author_insertKey',
    'author_rotateKeys',
    'author_removeExtrinsic',

    // unkonwn
    'offchain_localStorageSet'
])

export default Topic