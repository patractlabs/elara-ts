import Redis, { DBT } from '@elara/lib/utils/redis'
import { ChainConfig, ChainType, KEYS, Network } from '@elara/lib'

const KEY = KEYS.Chain
const Rd = new Redis(DBT.Chain).getClient()

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

const init = async () => {
    await newChain('Polkadot')
    // await newChain('Kusuma')
    process.exit(0)
}
// test()
init()