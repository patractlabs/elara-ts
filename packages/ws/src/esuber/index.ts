/// build connection to nodes
/// -- 1. read chain config
/// -- 2. parse rpc strategy
/// -- 3. runtime rpc strategy
/// suber resource manage
/// -- 1. subscription 
/// -- 2. rpc methond cache
import { getAppLogger, RpcStrategy } from 'lib'
import { Suber } from './interface'
import { chainInit } from './chain'

console.log('env: ', process.env.MODE)
const log = getAppLogger('esuber', true)

namespace Suber {
    // init suber service,
    // 1. chains init
    // 2. subers register
    export const init = async () => {
        return chainInit()
        // log.info('exts: ', G.chainExt['polkadot']['extends']['system_wtf'] === RpcStrategy.Abandon)
    }
    
}
export * from './chain'
export * from './interface'
export * from './global'
export default Suber