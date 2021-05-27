/// build connection to nodes
/// -- 1. read chain config
/// -- 2. parse rpc strategy
/// -- 3. runtime rpc strategy
/// suber resource manage
/// -- 1. subscription 
/// -- 2. rpc methond cache
import { getAppLogger, dotenvInit } from 'lib'
import { Suber } from './interface'
import S from './service'
dotenvInit()
const log = getAppLogger('esuber', true)
const ENV = process.env.NODE_ENV
const secure = ENV === 'pro' 

namespace Suber {
    // init suber service,
    // 1. chains init
    // 2. ws pool init
    export const init = async () => {
        log.info(`Suber init, current env [${ENV}]`)
        // await C.init()
        // Pool.init(secure)
        S.up(secure)
        // log.info('exts: ', G.chainExt['polkadot']['extends']['system_wtf'] === RpcStrategy.Abandon)
    }
    
}
export const Service = S
export * from './interface'
export * from './global'
export default Suber