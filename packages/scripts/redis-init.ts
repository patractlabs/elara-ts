import {Redis} from 'lib/utils'
import { ChainConfig, ChainType, KEYS, Network } from 'lib'

const KEY = KEYS.Chain
const Rd = new Redis({db: 3})
const Cd = new Redis({db: 4})

const init = async () => {
    const chain = 'Polkadot'
    const polkadot: ChainConfig = {
        name: chain,
        baseUrl: '127.0.0.1',
        wsPort: 9944,
        rpcPort: 9933,
        network: Network.Live,        // test
        chainType: ChainType.Relay,     // parallel
        extends: JSON.stringify({}),
        excludes: JSON.stringify(["system_peers", "state_subscribeStorage"]),
    }
    await Rd.hmset(KEY.hChain(chain), polkadot)
    let cnt = await Rd.incr(KEY.chainNum())
    await Rd.zadd(KEY.zChainList(), cnt, chain.toLowerCase())
    process.exit(0)
}


const test = async () => {
    let re = await Cd.hgetall(KEYS.Cache.hLatest('Polkadot', 'rpc_methods'))
    console.log(re)
    const res = JSON.parse(re.result)
    console.log(res.version)
    for (let m of res.methods) {
        console.log(m)
    }
}
// test()
// init()