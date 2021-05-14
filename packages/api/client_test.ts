import websocket from 'ws'

// const ws = new websocket('ws://localhost:80')

// ws.on('open', () =>{
//     console.log('connection open')
//     ws.send(`{"jsonrpc":"2.0","id":1,"method":"system_peers", "params":[]}`)
// })

// ws.on('close', () => {
//     // 服务端关闭会触发
//     // 主动close会触发
//     console.log('on close')
// })

// ws.on('message', (msg: any) => {
//     console.log('new msg in client: ', msg)
// })

// ws.on('error', (e) => {
//     console.log('on error: ', e)
// })

for (let i = 0; i < 1000; i++) {
    let url = 'ws://localhost:9944'
    // let url = 'ws://localhost:80'
    new websocket(url) 
}