import { dotenvInit } from 'lib'
dotenvInit()
import Config from 'config'

interface WsConf {
    maxConn: number,
    poolSize: number
}

namespace Conf {
    export const getWs = (): WsConf => {
        return Config.get('ws')
    }
}

export default Conf