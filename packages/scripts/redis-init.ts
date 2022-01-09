import { Redis, DBT, KEYS } from '@elara/lib'

const cKEY = KEYS.Chain

enum NodeType {
    Node = 'node',
    Kv = 'kv',
    Mem = 'memory'
}

interface ChainConfig {
    name: string,
    nodeId: number,       // default 0, elara node instance id
    type: NodeType,       
    baseUrl: string,      // host
    rpcPort?: number,      // only for Node type. default 9933, 
    wsPort: number,        // default 9944
    poolSize: number,
    [key: string]: any    // for redis
} 

// default localhost:6379, configure your own connection
// NOTE: don't change DBT.Chain type
const cRd = new Redis(DBT.Chain).getClient()

const newChain = async (chain: string) => {
    const polkadot: ChainConfig = {
        name: chain,
        type: NodeType.Node,
        baseUrl: '127.0.0.1',           // node url
        wsPort: 19944,                  // websocket port
        rpcPort: 19933,                 // http port
        nodeId: 0,                      // node instance id, when multi node deploy
        poolSize: 20
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