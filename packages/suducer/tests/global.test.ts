import { ChainConfig, isSome, isNone, RpcMapT, RpcStrategy } from 'elara-lib'
import { randomId } from '../../lib/utils'
import G from '../src/global'
import Suducer, { SuducerT } from '../src/suducer'

describe('chain test suit', () => {
    const chain: ChainConfig = {
        name: 'Polkadot',
        baseUrl: '127.0.0.1',
        rpcPort: 9933,
        wsPort: 9944,
        serverId: 0,
        excludes: ['system_peers'],
        extends: {
            'system_nodeRoles': RpcStrategy.Abandon,
        } as RpcMapT,
        kvEnable: true
    }
    it('none', () => {
        let re: any = G.getChain('polkadot')
        expect(isNone(re)).toBeTruthy
        re = G.getAllChains()
        expect(isNone(re)).toBeTruthy
    })

    it('add', () => {
        G.addChain(chain)
        let re: any = G.getChain('Polkadot')
        expect(isSome(re)).toBeTruthy
        const c = re.value
        expect(c).toEqual(chain)
        expect(c.excludes).toEqual(['system_peers'])
        re = G.getChain('polkadot')
        expect(re.value).toEqual(chain)
        re = G.getAllChainConfs()
        expect(re.value['polkadot']).toEqual(chain)
    })

    it('update', () => {
        let re: any = G.getChain('Polkadot')
        expect(isSome(re)).toEqual(true)
        const c = re.value
        c.excludes = ['system_health']
        c.extends = { 'sytem_owner': RpcStrategy.History }
        G.updateChain(c)
        let res: any = G.getChain('polkadot')
        expect(re).toEqual(res)
        const cc = res.value
        expect(cc.excludes).toEqual(['system_health'])
        expect(cc.extends).toEqual({ 'sytem_owner': RpcStrategy.History })
    })

    it('delete', () => {
        // G.addChain(chain)
        G.delChain('polkadot')
        let re: any = G.getChain('Polkadot')
        expect(isNone(re)).toBeTruthy
        re = G.getAllChains()
        expect(isNone(re)).toBeTruthy
    })
})

describe('suducer test suit', () => {
    const chain = 'Polkadot'
    const type = SuducerT.Sub
    const id = randomId()
    const suducer = {
        id,
        chain,
        type
    } as Suducer

    it('none', () => {
        let re: any = G.getSuducer(chain, type, id)
        expect(isNone(re)).toBeTruthy
        re = G.getSuducers(chain, type)
        expect(isNone(re)).toBeTruthy
    })

    it('add', () => {
        G.addSuducer(suducer)
        let re = G.getSuducer(chain, type, id)
        expect(isSome(re)).toBeTruthy
    })

    it('update', () => {
        suducer.topic = { id: '1', topic: 'chain_subscribeNewHeads', params: [] }
        G.updateSuducer(suducer)
        let re: any = G.getSuducer(chain, type, id)
        expect(re.value.topic).toEqual({ id: '1', topic: 'chain_subscribeNewHeads', params: [] })
    })

    it('delete', () => {
        G.delSuducer(chain, type, id)
        let re = G.getSuducer(chain, type, id)
        expect(isNone(re)).toBeTruthy
    })
})