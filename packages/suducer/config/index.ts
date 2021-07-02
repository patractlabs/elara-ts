import Config from 'config'

interface ServerConf {
    id: number,
    maxReconnTry: number,
    cachePoolSize: number
}

interface RedisConf {
    host: string,
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