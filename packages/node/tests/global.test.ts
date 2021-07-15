import { isOk, isErr } from '@elara/lib'
import { randomId } from '@elara/lib/utils'
import WebSocket from 'ws'
import G from '../src/global'
import { ReqT } from '../src/interface'
import Puber from '../src/puber'
import Suber from '../src/suber'

/// all the map result should be {} or map instance
/// all the instance should be Err or Ok

/// suber
describe('suber test suit', () => {
    const chain = 'polkadot'
    const id = randomId()
    const pubId1 = randomId()
    const pubId2 = randomId()
    let suber = {
        id,
        chain,
        url: 'ws://127.0.0.1:7001',
        ws: {} as WebSocket,
        pubers: new Set([pubId1])
    }
    it('node', () => {
        let re: any = G.getSuber(chain, id)
        expect(isErr(re)).toEqual(true)
        re = G.getChainSubers(chain)
        expect(re).toEqual({})
        re = G.getAllSubers()
        expect(re).toEqual({})
    })

    it('add suber', () => {
        G.updateAddSuber(chain, suber)
        let re = G.getSuber(chain, id)
        expect(isOk(re)).toEqual(true)
        const sub = re.value
        expect(sub).toEqual(suber)
    })

    it('get all subers', () => {
        let subs = G.getAllSubers()
        expect(subs[chain][id]).toEqual(suber)
    })

    it('get chain subers', () => {
        const subs = G.getChainSubers(chain)
        expect(subs[id]).toEqual(suber)
    })

    it('update suber pubers', () => {
        suber.pubers.add(pubId2)
        G.updateAddSuber(chain, suber)
        let re = G.getSuber(chain, id)
        expect(isOk(re)).toEqual(true)
        const sub = re.value as Suber
        expect(sub).toEqual(suber)
        expect(sub.pubers).toEqual(new Set([pubId1, pubId2]))
    })

    it('del suber', () => {
        G.delSuber(chain, id)
        let re = G.getSuber(chain, id)
        expect(isErr(re)).toEqual(true)
    })

})

describe('puber test suit', () => {
    const pubId = randomId()
    const chain = 'polkadot'
    const pid = '123456pid'
    const subId = randomId()
    let puber = {id: pubId, chain, ws: {} as WebSocket, pid} as Puber
    it('none', () => {
        let re: any = G.getPuber(pubId)
        expect(isErr(re)).toEqual(true)
        re = G.getPubers()
        expect(re).toEqual({})
    })

    it('add puber', () => {
        G.updateAddPuber(puber)
        let re = G.getPuber(pubId)
        expect(isOk(re)).toEqual(true)
        const pb = re.value as Puber
        expect(pb).toEqual(puber)
        expect(pb.subId).toEqual(undefined)
    })

    it('update puber', () => {
        puber.subId = subId
        G.updateAddPuber(puber)
        let re: any = G.getPuber(pubId)
        expect(isOk(re)).toEqual(true)
        expect(re.value.subId).toEqual(subId)
    })

    it('get all pubers', () => {
        let re = G.getPubers()
        expect(re[pubId]).toEqual(puber)
    })

    it('del puber', () => {
        G.delPuber(pubId)
        let re: any = G.getPuber(pubId)
        expect(isErr(re)).toEqual(true)
        re = G.getPubers()
        expect(re).toEqual({})
        expect(re[pubId]).toEqual(undefined)
    })
})

describe('subscribed topics suit', () => {
    const chain = 'polkadot'
    const pid = '12345678pid'
    const subsId = randomId()
    let topic = {id: subsId, pubId: 1, method: 'system_health', params: '[]'}

    it('none', () => {
        let re: any = G.getSubTopic(chain, pid, subsId)
        expect(isErr(re)).toEqual(true)
        re = G.getSubTopics(chain, pid)
        expect(re).toEqual({})
        re = G.getAllSubTopics()
        expect(re).toEqual({})
    })

    it('add sub topic', () => {
        G.addSubTopic(chain, pid, topic)
        let re: any = G.getSubTopic(chain, pid, subsId)
        expect(isOk(re)).toEqual(true)
        expect(re.value).toEqual(topic)
    })

    it('get topic', () => {
        let re: any = G.getAllSubTopics()
        expect(re[chain][pid][subsId]).toEqual(topic)
        re = G.getSubTopics(chain, pid)
        expect(re[subsId]).toEqual(topic)
    })

    it('remove topic', () => {
        G.remSubTopic(chain, pid, subsId)
        let re: any = G.getSubTopic(chain, pid, subsId)
        expect(isErr(re)).toEqual(true)
    })
})

describe('request cache suit', () => {
    const id = randomId()
    const chain = 'polkadot'
    const pid = randomId()
    let req = {id, pubId: 12345678, chain, pid, subId: id, originId: 1, type: 0, isSubscribe: true, jsonrpc: "2.0", method: "system_health", params: "[]"} as ReqT
    it('none', () => {
        let re: any = G.getReqCache(id)
        expect(isErr(re)).toEqual(true)
    })

    it('add request cache', () => {
        G.addReqCache(req)
        let re: any = G.getReqCache(id)
        expect(isOk(re)).toEqual(true)
        expect(re.value).toEqual(req)
    })

    it('update request cache', () => {
        req.subsId = '2'
        G.updateReqCache(req)
        let re: any = G.getReqCache(id)
        expect(re.value.subsId).toEqual(2)
    })

    it('delete request cache', () => {
        G.delReqCache(id)
        let re: any = G.getReqCache(id)
        expect(isErr(re)).toEqual(true)
    })
})

describe('subscribe map suit', () => {
    const subsId = randomId()
    const reqId = randomId()
    it('none', () => {
        let re: any = G.getReqId(subsId)
        expect(isErr(re)).toEqual(true)
    })

    it('add sub-req map', () => {
        G.addSubReqMap(subsId, reqId)
        let re: any = G.getReqId(subsId)
        expect(re.value).toEqual(reqId)
    })

    it('delete sub req map', () => {
        G.delSubReqMap(subsId)
        let re: any = G.getReqId(subsId)
        expect(isErr(re)).toEqual(true)
    })
})

