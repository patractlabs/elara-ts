import Config from 'config'

interface Redis {
    host: string,
    port: number,
    password: string,
    expire: number,
    statKeep: number,
    expireFactor: number,
    expireUnit: string
}

interface ApiServer {
    host: string,
    port: number
}


class Conf {
    static getRedis(): Redis {
        return Config.get("redis")
    }

    static getApiServer(): ApiServer {
        return Config.get("apiServer")
    }
}

export default Conf