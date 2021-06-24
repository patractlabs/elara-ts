import WebSocket, { EventEmitter } from 'ws'
import { getAppLogger, IDT, ResultT, Err, Ok, isErr, PVoidT } from 'lib'
import { randomId } from 'lib/utils'
import { WsData } from './interface'
import G from './global'
import Matcher from './matcher'
import Suber from './suber'
import Util from './util'

const log = getAppLogger('Puber', true)

interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    ws: WebSocket,
    subId?: IDT,            // suber id
    topics?: Set<string>,   // {subscribeId}
    event?: EventEmitter
}


namespace Puber {

    export const create = (ws: WebSocket, chain: string, pid: IDT): Puber => {
        const puber = { id: randomId(), pid, chain, ws } as Puber
        G.updateAddPuber(puber)
        return puber
    }

    export const updateTopics = (pubId: IDT, subsId: string): ResultT => {
        let re = G.getPuber(pubId)
        if (isErr(re)) {
            log.error(`update puber[${pubId}] topics error: ${re.value}`)
            // puber may be closed
            return Err(`puber[${pubId}] may be closed`)
        }
        const puber = re.value as Puber
        puber.topics = puber.topics || new Set<string>()
        puber.topics.add(subsId)
        G.updateAddPuber(puber)
        return Ok(puber)
    }

    export const transpond = async (puber: Puber, data: WsData): PVoidT => {
        const { id, chain, pid }  = puber
    
        // topic bind to chain and params 
        if (Matcher.isSubscribed(chain, pid, data)){
            log.warn(`The topic [${data.method}] has been subscribed, no need to subscribe twice!`)
            return puber.ws.send('No need to subscribe twice')
        }

        let re = Matcher.newRequest(chain, pid, id, data)
        if (isErr(re)) {
            log.error(`create new request error: ${re.value}`)
            return puber.ws.send(re.value)
        }
        const dat = re.value

        re = Matcher.getSuber(chain, id)
        if (isErr(re)) {
            log.error(`[SBH] send message error: ${re.value}`)
            process.exit(1) 
        }
        const suber = re.value as Suber

        // transpond requset
        log.info(`Send new message to suber[${suber.id}] of chain ${chain}, request ID: ${dat.id}`)
        return suber.ws.send(Util.reqFastStr(dat))
    }
}

export default Puber