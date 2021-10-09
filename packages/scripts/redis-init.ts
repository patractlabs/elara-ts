import { Redis, DBT } from '@elara/lib'
import { ChainConfig, ChainType, KEYS, Network } from '@elara/lib'

const cKEY = KEYS.Chain

// default localhost:6379, configure your own connection
// NOTE: don't change DBT.Chain type
const cRd = new Redis(DBT.Chain).getClient()

const newChain = async (chain: string) => {
    const polkadot: ChainConfig = {
        name: chain,
        baseUrl: '127.0.0.1',           // node url
        wsPort: 19944,                  // websocket port
        rpcPort: 19933,                 // http port
        network: Network.Live,          // optional
        chainType: ChainType.Relay,     //  optional
        serverId: 0,                    // node instance id, when multi node deploy
        kvEnable: false,                // if true, Elara-kv need
        kvPort: 9002,
        kvBaseUrl: '127.0.0.1'
    }
    await cRd.hmset(cKEY.hChain(chain, 0), polkadot)
    let cnt = await cRd.incr(cKEY.chainNum())
    await cRd.zadd(cKEY.zChainList(), cnt, chain.toLowerCase())
}

async function init() {
    await newChain('Polkadot')
    process.exit(0)
}
init()