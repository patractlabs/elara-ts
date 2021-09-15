import Mom from 'moment'
import Cacher from "./cacher"
import Chain, { NodeType } from "./chain"
import { getAppLogger, PVoidT, randomId } from '@elara/lib'
import Dao from "./dao"
import Suber from './matcher/suber'
import Emiter from './emiter'

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

function buildReq(reqId: string, method: string, params: any[]): string {

    const id = `ping-${reqId}`
    let data = {
        id,
        jsonrpc: "2.0",
        method,
        params
    }
    log.debug('rpc data to send: %o', data)
    return JSON.stringify(data)
}

export function suberMoniter(): void {
    setInterval(async () => {
        const subers = Suber.getAllSuber()
        let keys = Object.keys(subers)
        for (let k of keys) {
            const par = k.split('-')
            const chain = par[0]
            const type = par[1]
            const subs = subers[k]
            log.debug(`${chain}-${type} suber health check start`)
            for (let sub of Object.values(subs)) {
                try {
                    log.debug(`suber: ${sub.id}`)
                    // send calls to confirm suber connection
                    // active or not
                    if (type !== NodeType.Kv) {
                        const id = randomId()
                        // ping map cache
                        // udpate when pong response
                        const rpc = buildReq(id, 'chain_getBlockHash', [0])
                        sub.ws.send(rpc)
                    }
                } catch (err) {
                    log.error(`${chain}-${type} suber[${sub.id}] health check error: %o`, err)
                }
            }
        }
    }, 5000)
}

class Service {
    static async init(emiter: Emiter) {
        await Chain.init()
        Suber.init(emiter)
        cacherMoniter()
    }
}

export default Service