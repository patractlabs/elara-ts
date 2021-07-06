import { dotenvInit } from 'lib'
dotenvInit()
import Config from 'config'

interface ServerConf {
    id: number,
    port: number,
    maxWsConn: number,
    maxReConn: number
}

interface RedisConf {
    host: string,
    port: number,
    db: number,
    options?: any
}

interface PoolConf {
    sub: number,
    chan: number,
    maxConn: number,
    poolSize: number
}

namespace Conf {
    export const getServer = (): ServerConf => {
        return Config.get('server')
    }
    export const getRedis = (): RedisConf => {
        return Config.get('redis')
    }
    
    export const getWsPool = (): PoolConf => {
        return Config.get('wspool')
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

export default Conf

