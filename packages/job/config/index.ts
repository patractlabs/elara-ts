import Config from 'config'

interface Redis {
    host: string,
    port: number,
    db: number,
    password: string
}


namespace Conf {
    export function getRedis(): Redis {
        return Config.get("redis")
    }
}

export default Conf