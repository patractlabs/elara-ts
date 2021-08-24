import { Redis, DBT } from '@elara/lib'
import { ChainConfig, ChainType, KEYS, Network } from '@elara/lib'

const cKEY = KEYS.Chain
const pKEY = KEYS.Project
const cRd = new Redis(DBT.Chain).getClient()
const pRd = new Redis(DBT.Project).getClient()

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
    await cRd.hmset(cKEY.hChain(chain), polkadot)
    let cnt = await cRd.incr(cKEY.chainNum())
    await cRd.zadd(cKEY.zChainList(), cnt, chain.toLowerCase())
}


async function projectInit() {
    await pRd.hmset(pKEY.hProjecConf(), {
        maxWsConn: 20,       
    })
    return
}
const init = async () => {
    await newChain('Polkadot')
    // await newChain('Kusuma')
    process.exit(0)
}
// test()
init()