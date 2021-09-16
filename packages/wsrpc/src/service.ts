import Mom from 'moment'
import Cacher from "./suber/cacher"
import Chain, { NodeType } from "./chain"
import { getAppLogger, PVoidT, isNone } from '@elara/lib'
import Dao from "./dao"
import Suber from './suber'
import Emiter from './emiter'
import Matcher from './matcher'
import G from './global'
import Puber from './puber'

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

function cacherMoniter(): void {
    setInterval(async () => {
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
    return JSON.stringify(data)
}

function suberMoniter(): void {
    setInterval(async () => {
        log.debug(`suber health monitor start`)
    
        const subers = Suber.getAllSuber()
        let keys = Object.keys(subers)
        const now = Mom().utcOffset('+08:00', false).valueOf()
        for (let k of keys) {
            const par = k.split('-')
            const chain = par[0]
            const type = par[1]
            const subs = subers[k]
            log.debug(`${chain}-${type} subers health check start`)
            for (let sub of Object.values(subs)) {
                try {
                    // send calls to confirm suber connection
                    // active or not
                    if (type === NodeType.Kv) {
                        continue
                    }
                    // check first
                    const re = G.getPingCache(sub.id)
                    if (isNone(re)) {
                        // first or been clear
                        log.debug(`${chain} ${type} ping cache of suber[${sub.id}] is none`)
                        // ping map cache
                        G.addPingCache({
                            subId: sub.id,
                            startTime: Mom().utcOffset('+08:00', false).valueOf()
                        })
                        // udpate when pong response
                        const rpc = buildReq(sub.id.toString(), 'chain_getBlockHash', [0])
                        sub.ws.send(rpc)
                        continue
                    }
                    const { startTime } = re.value
                    const delay = (now - startTime) / 1000
                    if (delay > 20) {
                        // restart suber
                        log.error(`${chain} ${type} suber[${sub.id}] hasn't response over 20 seconds, ready to terminate.`)
                        sub.ws.terminate()
                    } else if (delay > 10) {
                        log.warn(`${chain} ${type} suber[${sub.id}] hasn't response over 10 seconds`)
                    }
                } catch (err) {
                    log.error(`${chain}-${type} suber[${sub.id}] health check error: %o`, err)
                }
            }
        }
    }, 10000)
}

function debugCacheMonitor() {
    log.info('cache status monitor start')
    setInterval(() => {
        const reReqs = Matcher.getAllReqCache()
        const pubReqs = Puber.getAllReqs()
        let prCnt = 0
        for (let p of Object.keys(pubReqs)) {
            const re = Puber.getReqs(p)
            prCnt += re.size
        }
        const subTopics = G.getAllSubTopics()
        const subMap = G.getAllSubReqMap()
        let subCnt = 0
        for (let s of Object.keys(subTopics)) {
            const par = s.split('-')
            const chain = par[0]
            const pid = par[1]
            const re = G.getSubTopics(chain, pid)
            subCnt += Object.keys(re).length
        }
        const tryMap = G.getTryMap()
        const connMap = G.getConnMap()
        const puber = Puber.getAll()
        const subers = Suber.getAllSuber()
        let suberCnt = 0
        for (let s of Object.keys(subers)) {
            const par = s.split('-')
            const chain = par[0]
            const type = par[1]
            const re = Suber.getSubersByChain(chain, type as NodeType)
            suberCnt += Object.keys(re).length
        }
        const pings = G.getAllPingCache()
        log.debug(`current request cache size: ${Object.keys(reReqs).length}`)
        log.debug(`current puber request cache size: ${prCnt}`)
        log.debug(`current subscribe topic cache size: ${subCnt}`)
        log.debug(`current subscribe request map cache size: ${Object.keys(subMap).length}`)
        log.debug(`current substry connection map cache size: ${Object.keys(tryMap).length}`)
        log.debug(`current connecion map cache size: ${Object.keys(connMap).length}`)
        log.debug(`current puber map cache size: ${Object.keys(puber).length}`)
        log.debug(`current suber map cache size: ${suberCnt}`)
        log.debug(`current ping map cache size: ${Object.keys(pings).length}`)

    }, 5000)
}

class Service {
    static async init(emiter: Emiter) {
        await Chain.init()
        Suber.init(emiter)
        cacherMoniter()
        suberMoniter()
        if (process.env.NODE_ENV === 'dev') {
            debugCacheMonitor()
        }
    }
}

export default Service