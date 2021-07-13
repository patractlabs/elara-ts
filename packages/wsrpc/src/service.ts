import Cacher from "./cacher"
import Chain from "./chain"
import Matcher from "./matcher"

function cacherMoniter(): NodeJS.Timeout {
    return setInterval(async () => {
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