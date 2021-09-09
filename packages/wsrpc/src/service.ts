import Mom from 'moment'
import Cacher from "./cacher"
import Chain from "./chain"
import Matcher from "./matcher"
import { getAppLogger, PVoidT } from '@elara/lib'
import Dao from "./dao"

const log = getAppLogger('service')

async function statusCheck(chain: string): PVoidT {
    let { result, updateTime } = await Dao.getChainCache(chain, 'system_syncState')
    let stat = Cacher.getPrestat(chain)
    const time = new Date(parseInt(updateTime))
    if (result === undefined || result === '') {
        log.error(`chain ${chain} cacher hasn't been sync: ${result} ${time}`)
        Cacher.updatePrestat(chain, { block: 0, acc: 0 })
        return Cacher.updateStatus(chain, false)
    }
    const { currentBlock } = JSON.parse(result)
    if (stat === undefined) {
        stat = { block: 0, acc: 0 }
    }
    let { block, acc } = stat
    let status = true
    const diff = Mom().utcOffset('+08:00', false).valueOf() - Mom(time).valueOf()
    if (currentBlock <= block && diff > 5000) {
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
    }, 6000)
}

namespace Service {
    export const init = async () => {
        await Chain.init()
        Matcher.init()
        cacherMoniter()
    }
}

export default Service