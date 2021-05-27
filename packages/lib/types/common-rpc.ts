export enum RpcStrategy {
    Abandon = 'Abandon',            
    Direct = 'Direct',              // direct to node
    History = 'Histrory',
    Kv = 'Kv',                      // elara kv storage service
    Subscribe = 'Subscribe',        // subscription 
    Unsub = 'Unsuvscribe',          // unsubscription
    SyncAsBlock = 'SyncAsBlock',    // update as block update
    SyncLow = 'SyncLow',            // 10min or more
    SyncOnce = 'SyncOnce',     
    SyncHistory = 'SyncHistory',      // depends in parameter
}

export type RpcMethodT = {[key in RpcStrategy]: string[]}

export const RpcMethods: RpcMethodT = {
    Abandon: [
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
        'author_rotateKey',
        'author_removeExtrinsic',
        
        // unkonwn
        'offchain_localStorageSet',
    ],
    Histrory: [
        
        'state_getStorage',
        'state_queryStorageAt',
    ],
    Kv: [
        // other subscription from elara-kv
    ],
    Subscribe: [
        'author_submitAndWatchExtrinsic', // node direct?

        'chain_subscribeAllHeads',
        'chain_subscribeNewHeads', 
        'chain_subscribeFinalizedHeads', 
        
        'state_subscribeRuntimeVersion',    // ?
        'state_subscribeStorage', 
    ],
    Unsuvscribe: [
        'author_unwatchExtrinsic',

        'chain_unsubscribeAllHeads',
        'chain_unsubscribeNewHeads',
        'chain_unsubscribeFinalizedHeads', 

        'state_unsubscribeRuntimeVersion', 
        'state_unsubscribeStorage',
    ],
    SyncAsBlock: [
        'system_syncState',
        'system_health',
        'chain_getHeader',  // without parameter, as lastest
        'chain_getBlock',
        'chain_getBlockHash',
        'chain_getFinalizedHead',
    ],
    SyncLow: [
        'state_getMetadata', // ensure update when runtimeVersion update
    ],
    // update when reconnect to node
    SyncOnce: [
        'rpc_methods',
        'system_version',
        'system_chain',
        'system_chainType',
        'system_properties',
    ],
    SyncHistory: [
        'chain_getBlock',   // with block or hash parameter
        'chain_getBlockHash',
        'chain_getHeader',
    ],
    // others not define here is Direct
    Direct: [],

}
export type RpcMapT = {[key: string]: RpcStrategy}
export const RpcMethodMap: RpcMapT = {
    // export sensitive info
    'system_nodeRoles': RpcStrategy.Abandon,
    'system_localListenAddresses': RpcStrategy.Abandon,
    'system_localPeerId': RpcStrategy.Abandon,
    
    // change the chain data
    'system_addLogFilter': RpcStrategy.Abandon,
    'system_resetLogFilter': RpcStrategy.Abandon,
    'system_addReservedPeer': RpcStrategy.Abandon,
    'system_removeReservedPeer': RpcStrategy.Abandon,
    
    'author_insertKey': RpcStrategy.Abandon,
    'author_rotateKey': RpcStrategy.Abandon,
    'author_removeExtrinsic': RpcStrategy.Abandon,
    
    // unkonwn
    'offchain_localStorageSet': RpcStrategy.Abandon,

    /// History, also in Sync
    'chain_getBlock': RpcStrategy.SyncHistory, 
    'chain_getBlockHash': RpcStrategy.SyncHistory,
    'chain_getHeader': RpcStrategy.SyncHistory,

    /// history
    'state_getStorage': RpcStrategy.History,
    'state_queryStorageAt': RpcStrategy.History,

    /// sub
    // 'author_submitAndWatchExtrinsic': RpcStrategy.Subscribe, 
    // 'author_unwatchExtrinsic': RpcStrategy.Unsub,

    'chain_subscribeAllHeads': RpcStrategy.Subscribe,
    'chain_unsubscribeAllHeads': RpcStrategy.Unsub,
    'chain_subscribeNewHeads': RpcStrategy.Subscribe, 
    'chain_unsubscribeNewHeads': RpcStrategy.Unsub,
    'chain_subscribeFinalizedHeads': RpcStrategy.Subscribe, 
    'chain_unsubscribeFinalizedHeads': RpcStrategy.Unsub, 
    
    'state_subscribeRuntimeVersion': RpcStrategy.Subscribe,    // ?
    'state_unsubscribeRuntimeVersion': RpcStrategy.Unsub, 
    'state_subscribeStorage': RpcStrategy.Subscribe, 
    'state_unsubscribeStorage': RpcStrategy.Unsub,

    /// 
    'system_syncState': RpcStrategy.SyncAsBlock,
    'system_health': RpcStrategy.SyncAsBlock,
    'chain_getFinalizedHead': RpcStrategy.SyncAsBlock,

    'state_getMetadata': RpcStrategy.SyncLow, // ensure update when runtimeVersion update

    'rpc_methods': RpcStrategy.SyncOnce,
    'system_version': RpcStrategy.SyncOnce,
    'system_chain': RpcStrategy.SyncOnce,
    'system_chainType': RpcStrategy.SyncOnce,
    'system_properties': RpcStrategy.SyncOnce,
}

export const SubMethod = {
    'chain_allHead': 'chain_subscribeAllHeads',
    'chain_newHead': 'chain_subscribeNewHeads', 
    'chain_finalizedHead': 'chain_subscribeFinalizedHeads', 
    
    'state_runtimeVersion': 'state_subscribeRuntimeVersion',    // ?
    'state_storage': 'state_subscribeStorage', 
}

export const isSyncAsBlock = (method: string): boolean => {
    return RpcMethodMap[method] === RpcStrategy.SyncAsBlock
}

export const isSyncLow = (method: string): boolean => {
    return RpcMethodMap[method] === RpcStrategy.SyncLow
}

// TODO
export const rpcDispatch = (method: string) => {
    switch(method) {
    case RpcStrategy.SyncLow:
        break
    case RpcStrategy.SyncAsBlock:
        break
    default:
        break

    }
}