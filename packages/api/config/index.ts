import Config from 'config'

interface Session {
    key: string,
    signed: boolean,
    maxAge: number,
    httpOnly: boolean
}

interface Server {
    port: number,
    session: Session,
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
    timeout: number,
    maxReqKeep: number
}

interface GithubT {
    clientID: string,
    clientSecret: string,
    callbackUrl: string
}

interface Account {
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

    export function getAccount(): Account {
        return Config.get("account")
    }
}

export default Conf