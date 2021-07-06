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
    chan: number
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

export = Conf

