import Cacher from "./cacher"
import Chain from "./chain"
import Matcher from "./matcher"
import { getAppLogger, PVoidT } from '@elara/lib'
import Dao from "./dao"

const log = getAppLogger('service')

async function statusCheck(chain: string): PVoidT {
    let { result, updateTime } = await Dao.getChainCache(chain, 'system_syncState')
    let stat = Cacher.getPrestat(chain)
    log.debug(`chain ${chain} cache result: %o %o`, result, stat)
    if (result === undefined || result === '') {
        log.error(`chain ${chain} cacher error: hasn't been sync`)
        Cacher.updatePrestat(chain, { block: 0, acc: 0 })
        return Cacher.updateStatus(chain, false)
    }
    const time = new Date(parseInt(updateTime))
    const { currentBlock } = JSON.parse(result)
    if (stat === undefined) {
        stat = {block: 0, acc: 0}
    }
    let { block, acc } = stat
    log.debug(`chain ${chain} sync block ${currentBlock}, update time: %o`, time)
    let status = true
    if (currentBlock <= block) {
        log.warn(`chain ${chain} cacher hasn't been update: ${block}-${currentBlock}, last update time: ${time}`)
        acc += 1
        if (acc > 3) {
            status = false
        }
    } else {
        acc = 0
    }
    Cacher.updatePrestat(chain, { block: currentBlock, acc })
    return Cacher.updateStatus(chain, status)
}

function cacherMoniter(): NodeJS.Timeout {
    return setInterval(async () => {
        const chains = Chain.getChains()
        for (let chain of chains) {
            statusCheck(chain)
        }
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