import { dotenvInit } from 'lib'
dotenvInit()
import Config from 'config'

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
    export const getRedis = (): RedisConf => {
        return Config.get('redis')
    }
    
    export const getWsPool = (): PoolConf => {
        return Config.get('wspool')
    }

}

export = Conf
