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


namespace Conf {
    export function getRedis(): Redis {
        return Config.get("redis")
    }

    export function getApiServer(): ApiServer {
        return Config.get("apiServer")
    }
}

export default Conf