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

class Conf {
    static getServer(): Server {
        return Config.get("server")
    }

    static getRedis(): Redis {
        return Config.get("redis")
    }

    static getDB(): DB {
        return Config.get("db")
    }

    static getUser(): User {
        return Config.get("user")
    }
}

export default Conf