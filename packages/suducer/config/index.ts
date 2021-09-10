import Config from 'config'

interface ServerConf {
    maxReconnTry: number,
    cachePoolSize: number
}

interface RedisConf {
    host: string,
    password: string,
    port: number
}

class Conf {
    static getServer(): ServerConf {
        return Config.get('server')
    }

    static getRedis(): RedisConf {
        return Config.get('redis')
    }
}
export default Conf