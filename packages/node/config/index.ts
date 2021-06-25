import { dotenvInit } from 'lib'
dotenvInit()
import Config from 'config'

interface WsConf {
    maxConn: number,
    poolSize: number
}

interface ServerConf {
    id: number,     // for chain group
    port: number,
    maxReconnTry: number    // max re-connection try 
}

namespace Conf {

    export const getServer = (): ServerConf => {
        return Config.get('server')
    }

    export const getWs = (): WsConf => {
        return Config.get('ws')
    }
}

export default Conf