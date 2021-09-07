import Ws from 'ws'

const log = console

const methods_1 = ["chain_getBlockHash", "state_getRuntimeVersion", "system_chain", "system_properties", "rpc_methods", "state_getMetadata"]
const params_1 = [[0], [], [], [], [], []]
const methods_2 = [
    "state_subscribeRuntimeVersion",
    "state_subscribeStorage",
    "state_getStorage",
    "state_getStorage",
    "system_properties",
    "system_chain",
    "system_chainType",
    "system_name",
    "system_version",
    "state_subscribeStorage",
    "chain_subscribeNewHead"
]

const params_2 = [
    [],
    [["0x5f3e4907f716ac89b6347d15ececedca308ce9615de0775a82f8a94dc3d285a1"]],
    ["0xcec5070d609dd3497f72bde07fc96ba0e0cdd062e6eaf24295ad4ccfc41d4609"],
    ["0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9ff0f22492f44bac4c4b30ae58d0e8daa0000000000000000000000000000000000000000000000000000000000000000"],
    [],
    [],
    [],
    [],
    [],
    [["0xcec5070d609dd3497f72bde07fc96ba088dcde934c658227ee1dfafcd6e16903"]],
    []
]

const methods_3 = [
    "state_subscribeStorage",
    "state_subscribeStorage",
    "state_subscribeStorage",
    "state_subscribeStorage",
    "state_subscribeStorage",
    "state_subscribeStorage",
    "chain_subscribeFinalizedHeads",
    "state_subscribeStorage",
    "state_getKeysPaged",
    "state_subscribeStorage",
    "state_subscribeStorage",
    "state_subscribeStorage"
]

const params_3 = [
    [["0x89d139e01a5eb2256f222e5fc5dbe6b3e37921d32604f381943d4150ed81c7eb"]],
    [["0x11f3ba2e1cdd6d62f2ff9b5589e7ff816254e9d55588784fa2a62b726696e2b1"]],
    [["0xf0c365c3cf59d671eb72da0e7a4113c49f1f0515f462cdcf84e0f1d6045dfcbb"]],
    [["0xc2261276cc9d1f8598ea4b6a74b15c2f57c875e4cff74148e4628f264b974c80"]],
    [["0xcec5070d609dd3497f72bde07fc96ba072763800a36a99fdfc7c10f6415f6ee6", "0x5f3e4907f716ac89b6347d15ececedca487df464e44a534ba6b0cbb32407b587", "0x5f3e4907f716ac89b6347d15ececedca0b6a45321efae92aea15e0740ec7afe7", "0x5f3e4907f716ac89b6347d15ececedca138e71612491192d68deab7e6f563fe1"]],
    [["0x5f3e4907f716ac89b6347d15ececedcaf7dad0317324aecae8744b87fc95f2f3"]],
    [],
    [["0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7"]],
    ["0x1a736d37504c2e3fb73dad160c55b2918ee7418a6531173d60d1f6a82d8f4d51", 1000, "0x1a736d37504c2e3fb73dad160c55b2918ee7418a6531173d60d1f6a82d8f4d51"],
    [["0x2aeddc77fe58c98d50bd37f1b90840f91f7f3f3eb1c2a69978da998d19f74ec5"]],
    [["0x5f3e4907f716ac89b6347d15ececedcaac0a2cbf8e355f5ea6cb2de8727bfb0c"]],
    [["0x2aeddc77fe58c98d50bd37f1b90840f9cd7f37317cd20b61e9bd46fab87047140b81ae860ae1f2884877511245f8954e48858da743b9eb3544681c27ffd8802c8ea1669e961a2b61","0x2aeddc77fe58c98d50bd37f1b90840f943a953ac082e08b6527ce262dbd4abf29b6c7d30389e104491c2397c994076d94877511245f8954e48858da743b9eb3544681c27ffd8802c8ea1669e961a2b61"]]
]

let conncnt = 0

export async function sleeps(s: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, s * 1000))
}

async function send(ws: Ws, methods: string[], params: any[], start: number) {

    for (let i = 0; i < methods.length; i++) {
        let rpc = JSON.stringify({
            id: start + i,
            jsonrpc: "2.0",
            method: methods[i],
            params: params[i]
        })
        ws.send(rpc)
        log.info('send method: ', rpc)
    }
}

async function run(url: string, options: { mode?: number, batch?: boolean, id?: number } = { mode: 0, batch: false }) {
    try {
        const { mode, batch, id } = options
        batch
        id
        const wss = new Ws(`${url}`)
        let id_1 = new Set([1, 2, 3, 4, 5, 6])
        let id_2 = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17])
        let id_3 = new Set([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29])

        wss.on("close", (code, reason) => {
            conncnt -= 1
            log.error('ws connection close: ', code, reason, conncnt)
            if (code === 1006) {
                process.exit(1)
            }
        })

        wss.on("open", async () => {
            conncnt += 1
            log.info('ws connection open: ', conncnt)

            send(wss, methods_1, params_1, 1)
        })

        wss.on("error", (err) => {
            log.error('ws connection error: ', err)
        })

        wss.on("message", async (data) => {
            const dat = JSON.parse(data.toString())
            log.info('receive ws data: ', dat.id)
            id_1.delete(dat.id)
            id_2.delete(dat.id)
            id_3.delete(dat.id)
            if (id_1.size === 0) {
                log.info('stage 1 rpc done')
                send(wss, methods_2, params_2, 7)
                if (batch && mode === 1) {
                    run(url, options)
                }
                id_1.add(0)     // close off
            }

            if (id_2.size === 0) {
                log.info('stage 2 rpc done')
                if (mode !== 0) { 
                    log.error('mode 0, to close ws socket connection')
                    wss.close(1001) 
                }
                send(wss, methods_3, params_3, 18)
                id_2.add(0)
            }

            if (id_3.size === 0) {
                log.info('stage 3 rpc done')
                id_3.add(0)
            }
        })
    } catch (err) {
        log.error('catch error: ', err)
    }
}

// run("wss://test-pro.pub.elara2.patract.cn/kusama/00000000000000000000000000000000")
// run("ws://localhost:9944/Polkadot/00000000000000000000000000000000")
// run("wss://pub.elara.patract.io/Polkadot/00000000000000000000000000000000")
// run("wss://pub.elara.patract.io/kusama")
// 
// const url = "wss://pub.elara.patract.io/kusama"
const url = "wss://test-pro.pub.elara2.patract.cn/kusama"

async function main(url: string, loop: number = 0) {
    if (loop === 0) {
        run(url, {mode: 0, batch: true})
    }
    for (let i = 0; i < loop; i++) {
        run(url, { mode: 0, batch: true, id: i + 1 })
    }
}

main(url, 100)