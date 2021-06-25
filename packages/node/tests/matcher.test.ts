import WebSocket from 'ws'
import { isOk } from 'lib'
import { randomId } from 'lib/utils'
import G from '../src/global'
import Matcher from '../src/matcher'
import Suber from '../src/suber'

describe('matcher test suit', () => {
    const pubId = randomId()
    const chain = 'polkadot'
    const subId = randomId()
    const suber = {
        id: subId,
        chain,
        url: '123.com', ws: {} as WebSocket 
    } as Suber
    let puber = {id: pubId, pid: 1, chain, ws: {} as WebSocket }
    // const req = {}

    it('regist',  async () => {
        G.updateAddPuber(puber)
        G.updateAddSuber(chain, suber)
        await Matcher.regist(puber)
        let re: any = G.getChainSubers(chain)
        // expect(re[subId]).toEqual({...suber, pubers: new Set([pubId])})
        expect(re[subId].pubers).toEqual(new Set([pubId]))
        re = G.getPuber(pubId)
        expect(isOk(re)).toEqual(true)
        expect(re.value.subId).toEqual(subId)
    })

    it('unregist', async () => {
        // Matcher.setSubContext()
        let re: any = await Matcher.unRegist(pubId)
        re = G.getChainSubers(chain)
        expect(re[subId]).toEqual({...suber, pubers: new Set()})
        expect(re[subId].pubers).toEqual(new Set())
    })
})