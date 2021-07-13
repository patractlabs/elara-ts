import Cacher from "./cacher"
import Chain from "./chain"
import Matcher from "./matcher"
import { getAppLogger } from 'lib'

const log = getAppLogger('service')

function cacherMoniter(): NodeJS.Timeout {
    return setInterval(async () => {
        log.info(`cacher status check`)
        // TODO
        // const {result, updateTime} = await Dao.getCacheStatus(chain, 'system_syncState')
        Cacher.updateStatus(false)
    }, 5000)
}

namespace Service {
    export const init = async () => {
        await Chain.init()
        Matcher.init()
        cacherMoniter()
    }
}

export default Service