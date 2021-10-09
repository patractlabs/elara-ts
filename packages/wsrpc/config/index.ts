import { dotenvInit } from '@elara/lib'
dotenvInit()
import Config from 'config'

interface ServerConf {
    id: number,
    port: number,
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

class Conf {
    static getServer(): ServerConf {
        return Config.get('server')
    }
    static getRedis(): RedisConf {
        return Config.get('redis')
    }

    static getWsPool(): PoolConf {
        return Config.get('wspool')
    }
}

export default Conf