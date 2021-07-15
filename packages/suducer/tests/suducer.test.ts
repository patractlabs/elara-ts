import WebSocket from 'ws'
import { isSome } from 'elara-lib'
import Suducer, { SuducerT } from '../src/suducer'
import { TopicT } from '../src/interface'
import G from '../src/global'

describe('suducer test suit', () => {
    const chain = 'Polkadot'
    const url = '127.0.0.1'
    const type = SuducerT.Sub
    const topic = {} as TopicT
    const ws = {} as WebSocket
    it('none', () => {

    })

    it('create', () => {
        const suducer = Suducer.create(chain, type, ws, url, topic)
        let re: any = G.getSuducer(chain, type, suducer.id)
        expect(isSome(re)).toBeTruthy
        expect(re.value).toEqual(suducer)
        expect(re.value.cluster).toEqual(0)
    })

    
})