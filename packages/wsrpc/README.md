# WSRPC

## 依赖

### `Redis`

配置参照 config/default.json redis

初始化 polkadot 链：

```sh
cd ../scripts
npm i -S
npm i -S ../lib
```

执行 ts-node ../scripts/redis-init.ts
或者编译成 js，用 node 执行

### `substrate node`

```txt
默认端口 9944 9933
```

### `Elara-kv-component`

```txt
默认端口 9002
```

可以更改`redis-init.ts`文件的初始化参数

```js
const polkadot: ChainConfig = {
    name: chain,
    baseUrl: "127.0.0.1",
    wsPort: 19944,
    rpcPort: 19933,
    network: Network.Live, // test
    chainType: ChainType.Relay, // parallel
    extends: JSON.stringify({}),
    excludes: JSON.stringify(["system_peers", "state_subscribeStorage"]),
    serverId: 0,
    kvEnable: true,
    kvPort: 9002,
    kvBaseUrl: "127.0.0.1",
};
```

项目依赖

```sh
npm i -S
npm i -S ../lib
```

## 运行

```sh
# 直接运行
ts-node ./app.ts
# 或者编译运行
tsc -b
node ./dist/app.js
```
