import Config from 'config'

interface ServerConf {
    id: number,     // match the chain configure serverId
    maxReconnTry: number,
    cachePoolSize: number
}

interface RedisConf {
    host: string,
    password: string,
    port: number
}

namespace Conf {
    export const getServer = (): ServerConf => {
        return Config.get('server')
    }

    export const getRedis = (): RedisConf => {
        return Config.get('redis')
    }
}
export default Conf