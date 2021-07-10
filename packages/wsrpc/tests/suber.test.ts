import WebSocket from "ws"
import { randomId } from "lib/utils"
import Suber, { SuberTyp, SuberStat } from "../src/matcher/suber"
import { isNone } from "../../lib"

describe('suber G test suit', () => {
    const ws = {} as WebSocket
    const url = '127.0.0.1'
    const chain = 'polkadot'
    const type = SuberTyp.Kv
    const pubId = randomId()
    const subId = randomId()
    const pubers = new Set([pubId])
    const suber = { id: subId, ws, url, chain, type, stat: SuberStat.Create, pubers } as Suber
    it('none', () => {
        let re = Suber.G.getAll()
        expect(re).toEqual({})
    })

    it('add', () => {
        Suber.G.updateOrAdd(chain, type, suber)
        let re: any = Suber.G.get(chain, type, subId)
        expect(isNone(re)).toBeFalsy()
        const sub = re.value as Suber
        expect(sub.pubers).toEqual(new Set([pubId]))
        let pid = randomId()
        sub.pubers?.add(pid)
        Suber.G.updateOrAdd(chain, type, sub)
        let res: any = Suber.G.get(chain, type, sub.id)
        expect(res.value.pubers).toEqual(new Set([pubId, pid]))
    })
})