import { dotenvInit } from '@elara/lib'
dotenvInit()
import Config from 'config'

interface ServerConf {
    id: number,
    port: number,
    maxWsConn: number,
    maxReConn: number,
    apiHost: string,
    apiPort: number
}

interface RedisConf {
    host: string,
    password: string,
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
    export function getServer(): ServerConf {
        return Config.get('server')
    }
    export function getRedis(): RedisConf {
        return Config.get('redis')
    }

    export function getWsPool(): PoolConf {
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