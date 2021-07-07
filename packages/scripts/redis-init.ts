import Redis, { DBT } from 'lib/utils/redis'
import { ChainConfig, ChainType, KEYS, Network } from 'lib'

const KEY = KEYS.Chain
const Rd = Redis.newClient(DBT.Chain).client
const Cd = Redis.newClient(DBT.Cache).client

const newChain = async (chain: string) => {
    // const chain = 'Polkadot'
    const polkadot: ChainConfig = {
        name: chain,
        baseUrl: '127.0.0.1',
        wsPort: 19944,
        rpcPort: 19933,
        network: Network.Live,        // test
        chainType: ChainType.Relay,     // parallel
        extends: JSON.stringify({}),
        excludes: JSON.stringify(["system_peers", "state_subscribeStorage"]),
        serverId: 0,
        kvEnable: true,
        kvPort: 9002,
        kvBaseUrl: '127.0.0.1'
    }
    await Rd.hmset(KEY.hChain(chain), polkadot)
    let cnt = await Rd.incr(KEY.chainNum())
    await Rd.zadd(KEY.zChainList(), cnt, chain.toLowerCase())
}

const test = async () => {
    let re = await Cd.hgetall(KEYS.Cache.hCache('Polkadot', 'rpc_methods'))
    console.log(re)
    const res = JSON.parse(re.result)
    console.log(res.version)
    for (let m of res.methods) {
        console.log(m)
    }
}

const init = async () => {
    await newChain('Polkadot')
    // await newChain('Kusuma')
    process.exit(0)
}
// test()
init()