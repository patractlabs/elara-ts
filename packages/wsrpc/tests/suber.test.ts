import WebSocket from 'ws'
import { randomId, isNone } from '@elara/lib'
import Suber, { SuberStat } from '../src/suber'
import { NodeType } from '../src/chain'

describe('suber G test suit', () => {
    const ws = {} as WebSocket
    const url = '127.0.0.1'
    const chain = 'polkadot'
    const type = NodeType.Kv
    const pubId = randomId()
    const subId = randomId()
    const pubers = new Set([pubId])
    const suber = { id: subId, ws, url, chain, type, stat: SuberStat.Create, pubers } as Suber
    it('none', () => {
        let re = Suber.getAllSuber()
        expect(re).toEqual({})
    })

    it('add', () => {
        Suber.updateOrAddSuber(chain, type, suber)
        let re: any = Suber.getSuber(chain, type, subId)
        expect(isNone(re)).toBeFalsy()
        const sub = re.value as Suber
        expect(sub.pubers).toEqual(new Set([pubId]))
        let pid = randomId()
        sub.pubers?.add(pid)
        Suber.updateOrAddSuber(chain, type, sub)
        let res: any = Suber.getSuber(chain, type, sub.id)
        expect(res.value.pubers).toEqual(new Set([pubId, pid]))
    })
})