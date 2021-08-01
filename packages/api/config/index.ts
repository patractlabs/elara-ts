import Config from 'config'

interface Server {
    port: number,
    isTest: boolean
}

interface Redis {
    host: string,
    port: number,
    db: number,
    password: string
}

interface LimTypT {
    develop: number,
    team: number
}

interface Limit {
    daily: LimTypT,
    project: LimTypT,
    maxProjectNum: number,
    reqSecLimit: number,
    bwDayLimit: number,
    timeout: number,
    maxReqKeep: number
}

interface GithubT {
    clientID: string,
    clientSecret: string,
    callbackUrl: string
}

interface User {
    loginUrl: string,
    github: GithubT,
    defaultLevel: number,
    apiKey: string
}

namespace Conf {
    export function getServer(): Server {
        return Config.get("server")
    }

    export function getRedis(): Redis {
        return Config.get("redis")
    }

    export function getLimit(): Limit {
        return Config.get("limit")
    }

    export function getUser(): User {
        return Config.get("user")
    }
}

export default Conf