import Config from 'config'

interface Server {
    port: number
}

interface Redis {
    host: string,
    port: number,
    password: string
}

interface DB {
    host: string,
    port: number,
    table: string,
    user: string,
    password: string
}

interface GithubT {
    clientID: string,
    clientSecret: string,
    callbackUrl: string
}

interface User {
    loginUrl: string,
    github: GithubT,
}

namespace Conf {
    export function getServer(): Server {
        return Config.get("server")
    }

    export function getRedis(): Redis {
        return Config.get("redis")
    }

    export function getDB(): DB {
        return Config.get("db")
    }

    export function getUser(): User {
        return Config.get("user")
    }
}

export default Conf