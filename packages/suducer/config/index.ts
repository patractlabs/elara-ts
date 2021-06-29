import Config from 'config'

interface ServerConf {
    id: number,
    maxReconnTry: number
}

namespace Conf {
    export const getServer = (): ServerConf => {
        return Config.get('server')
    }
}
export default Conf