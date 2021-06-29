/// build connection to nodes
/// -- 1. read chain config
/// -- 2. parse rpc strategy
/// -- 3. runtime rpc strategy
/// Suducer resource manage
/// -- 1. subscription 
/// -- 2. rpc methond cache
import { getAppLogger, dotenvInit } from 'lib'
import S from './service'
dotenvInit()
const log = getAppLogger('eSuducer', true)
const ENV = process.env.NODE_ENV
const secure = ENV === 'pro' 

namespace Suducer {
    // init Suducer service,
    // 1. chains init
    // 2. ws pool init
    export const init = async () => {
        log.info(`Suducer init, current env [${ENV}]`)
        // await C.init()
        // Pool.init(secure)
        S.up(secure)
        // log.info('exts: ', G.chainExt['polkadot']['extends']['system_wtf'] === RpcStrategy.Abandon)
    }
    
}
export * from './interface'
export * from './global'