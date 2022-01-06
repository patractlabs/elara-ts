#### Elara v2.0

Elara v2.0在原先的业务逻辑上用typescript进行重构升级。重构目标：

```
1. 提高项目的可维护性
2. 提高项目的稳定性
3. 提高项目可用性，水平扩展
4. 解决Elara1.0目前已知的问题
5. 优化资源管理及服务能力
```

## 项目架构

按服务模块分包，每个包相当于一个微服务。

##### 包结构

```js
pakages
|___job			// 定时任务,收集elara项目统计数据
|___api			// elara官网api服务
|___suducer		// wsrpc的缓存服务，针对最新区块数据
|___lib			// 公共库
|___script		// 相应脚本
|___wsrpc		// elara核心服务，rpc请求，ws订阅管理

```

##### 服务结构

```js
wsrpc
|___logs						// 输出日志
|___config						// 配置
	|___default.json			// common config
	|___dev.json				// NODE_ENV === dev, development
	|___pro.json				// NODE_ENV === pro， production
	|___test.json				// NODE_ENV === test，所有环境配置应与pro相同
|___src	
	|___dao						// 持久层数据对象
	|___suber					// suber组件
		|___cacher				// 缓存，来自suducer
		|___kver				// kv
		|___noder				// 节点直连
		|___recorder			// archive
		|___index.ts			// 导出，初始化，组件入口
		|___suber.test.ts		// 组件测试
	|___puber
	|___matcher
	|___global.ts				// global变量定义
	|___interface.ts			// 接口定义
	|___ ...
|___dist						// 编译后js目标文件
|___tests						// 集成测试
|___app.ts						// 入口文件
|___package.json
|___tsconfig.json
|___ .env						// 环境变量配置
|___pm2.json
|___.gitignore
```

#### 命名规范

- 公共导出类型以 `CapTypeT`格式，以`T`结尾
- 全局共享变量，模块共享变量均以命名空间 `G`导出
- 导出方式以文件夹，而不是文件，即文件夹下`index.ts`统一导出
- 能使用`const`的尽量不用`let`，禁止`var`



## Elara服务

Elara v2.0服务分为两个逻辑部分，Elara官网服务以及polkadot生态服务。官网服务包括`api`和`job`两个模块。**api**负责Elara官网的登录，项目创建，以及dashboard等服务。**job**通过redis stream的消息队列，接收wsrpc模块的原始请求统计数据，将其格式化存入redis。polkadot生态服务包括`wsrpc`和`suducer`，**wsrpc**是polkadot生态节点的代理服务，为减轻节点的服务压力以及提高节点的服务能力，由Elara做统一订阅和资源分发。**suducer**为wsrpc服务做单独的缓存订阅，将节点最新区块数据以及高频率请求做周期缓存。

#### 依赖

`postgresql`： 用于存储Elara项目数据以及用户数据

`redis ^5.0`： 用于Elara缓存服务，包括用户和项目的状态，统计数据，节点数据和业务缓存数据等

`nodejs ^14`:    用于运行Elara服务

#### 配置

##### 节点配置

在redis的db3中，需要为支持的链和节点配置启动信息。同类型节点多实例需要配置不同的ID。

```ts
Z_chain_list	// 支持的链列表，zset类型 score: chain_name
	0: polkadot
    1: kusama
```

每个配置节点有自己的类型和id,

```ts
type = 'node' | 'kv' | 'memory'
```

节点配置需要在*有序集合*· `Z_chain_[name]_ids`中注册才生效，其中nodeId需要和节点配置suffix中的数值对应。

```ts
// polkadot有效的两个节点配置，0和1
Z_Chain_polkadot_ids	// score: nodeId
	0: 0	// nodeId 0 和 H_Chain_polkadot_0 后缀0对应
	1: 1
```

比如polkadot节点0的同步节点和kv节点1

```ts
H_Chain_polkadot_0	// polkadot链节点0配置，后缀0和ids列表中nodeId对应
{
	name: polkadot
	baseUrl: 127.0.0.1
	wsPort: 9944
	rpcPort: 9933
	type: node
	nodeId: 0
    poolSize: 50	// suber初始化连接池大小
}

H_Chain_polkadot_1	// polkadot链kv节点1配置
{
	name: polkadot
	baseUrl: 127.0.0.1
	wsPort: 9002
	type: kv
	nodeId: 1
    poolSize: 50
}
```

##### 环境配置

每个服务需要指定运行环境变量`NODE_ENV`,来读取`config/`路径下相应的配置文件(`pro.json|dev.json`)。

```ts
NODE_ENV = pro | dev
```

job等服务由额外的环境变量，参照`.env_example`进行设置。

**NOTE**：job和api中的AUTH变量，是base64的编码，需要对应。

### wsrpc

wsrpc由三部分构成，`matcher、suber`和`puber`。matcher负责suber和puber的映射管理；puber负责Apps的连接请求以及请求分发；suber负责向各节点建立资源连接，为puber提供后端数据能力。

当前wsrpc采用1-1的订阅模型，后续可以升级为N-1以提高Elara服务能力和client端响应能力。

#### suber

负责初始化节点连接资源,处理绑定到suber对象上的message回调。suber对象根据资源类型分为以下几种

```ts
cacher:	缓存资源，有suducer服务负责更新
noder: 节点直连资源，在其他策略失效时，转发到该资源对象上
kver: elara-kv，节点订阅托管资源
recorder: 节点历史数据，由elara-archive提供(暂未接通)
```

每个suber对象会维护一个puber列表(集合)，并且有全局的suber对象和订阅话题列表来管理对象的资源。

```ts
interface Suber {
    id: IDT,
    chain: string,
    nodeId: number,
    url: string,
    ws: WebSocket,
    type: NodeType,
    stat: SuberStat,
    pubers?: Set<IDT>,    // {pubId}
}
class Suber {

    private static g: ChainSuber = {}

    private static topic: Record<string, SubscripT> = {}
	
    // ---snip----
}
```

##### 服务策略

优先对应的资源对象提供服务，当非noder资源失效时，将请求转发到noder上。

**NOTE**：kver资源失效，只能是在kver服务层失败的情况下才能感知

###### cacher缓存有效性

wsrpc周期性对cacher数据进行监测，有效监测周期为5秒，当累计未更新3次后会将cacher有效状态置为false。

##### message处理

suber的message分为以下几类

```
1. node response	// 同步节点数据，根据实际消息类型进行解析
2. kv response	// kv节点数据，需要解构
3. ping	// 节点健康检查心跳包
```

kv节点数据解构后成为标准同步节点数据包。

###### 非订阅消息

对于非订阅消息，收到直接转发给puber，并将request cache上下文清除。

###### 订阅消息

- 首次订阅成功

  更新request cache，将subscription ID记录，用以接收后续的订阅回复。

  **NOTE**：当订阅回复先于订阅成功消息包时，本地缓存1分钟，在收到订阅成功后，将缓存的订阅回复一并转发，并清除订阅回复缓存。

- 订阅回复

  转发puber，无论消息是error还是result，只做转发

- 取消订阅

  取消成功，清除相应订阅cache的上下文，转发取消订阅成功回复，当puber关闭导致的取消订阅无需转发。

  取消失败，转发取消订阅结果

#### puber

接收来自client端的连接和请求，通过matcher申请suber资源。根据请求的资源类型，调用suber相应的资源对象进行请求。

```ts
interface Puber {
    id: IDT,
    pid: IDT,
    chain: string,
    nodeId: number,
    ws: WebSocket,
    topics: Set<string>,   // {subscribeId}
    subId: IDT,            // suber id
    kvSubId?: IDT,          // kv 
    memSubId?: IDT          // memory node
}

class Puber {
    private static g: Record<string, Puber> = {}
 
    private static reqs: Record<string, Set<string>> = {}
    // ----snip-----
}
```

puber对象为了提高资源清理时的效率，维护了自己的请求缓存和订阅列表。每一个puber和链、项目以及节点实例绑定。

#### matcher

负责puber和suber的绑定，以及请求的缓存管理。当puber和suber绑定后，完整的链路也就建立。matcher负责puber和suber的订阅管理，以及资源清除。在suber或者puber断开连接或者服务不可用时，管理相应的资源释放与重新分配。

###### suber异常

清除suber对象的资源，并通知绑定的puber关闭。

**NOTE：** polkadotjs不管代理节点的连通性，Elara只有将Apps的连接通道关闭转为不可用状态，才能触发apps的重连动作。apps会有重试机制，两次之后会清除之前的订阅列表，导致后续的订阅无法正常接收，哪怕Elara恢复，apps也无法恢复，必须刷新页面重新建立连接。

###### puber异常

```
1. 释放相应的连接，并取消已订阅的topic
2. 清除request上下文
3. 清除puber资源
```

###### 节点异常

当前节点异常立刻清除已分配的所有资源，重新尝试建立新连接。

TODO：连接保持，如何让apps能够恢复？

### suducer

suducer启动时会初始化一次性资源并注册周期task，当订阅节点的runtimeversion更新时，会更新一次性资源。

##### 资源列表

###### 订阅

```
state_subscribeRuntimeVersion
```

###### 一次性资源

```
"rpc_methods",
"system_name",
"system_version",
"system_chain",
"system_chainType",
"system_properties",
"state_getMetadata",
"state_getRuntimeVersion"
```

`chain_getBlockHash[0]`也在一次性缓存策略当中

###### 周期更新

更新周期5秒

```
"system_syncState",
"system_health",
"chain_getHeader",
"chain_getBlock",
"chain_getBlockHash",
"chain_getFinalizedHead"
```

### api

Elara官网后端服务

##### api文档

详细api查看知识库文档`elara-ts_api_doc.md`

### job

负责处理wsrpc发送的请求统计数据，对不同维度的统计信息进行归档，以供api服务使用。

```ts
1. Elara项目汇总统计
2. 每条链汇总统计
3. Elara项目汇总天统计
4. 项目天统计
5. 项目小时统计

// job/src/service.ts  handleStat
KEY.hTotal(),
KEY.hChainTotal(req.chain),
KEY.hDaily(today),
KEY.hProDaily(chain, pid, today),
KEY.hProHourly(chain, pid, currentHourStamp())
```

同时处理每个项目相应的带宽、国家统计数据。对于Elara项目进行资源限额检查，超过账户限额会更新用户和项目的可用状态，并在UTC+8时间0点重置状态。

#### 编译执行

```js
yarn install
// ts-node 执行
yarn service_name start	// service_name = wsrpc | job | suducer | api

// node 执行
yarn build
yarn service_name start:node
```

#### RPC列表

```
// 同块周期 6s
chain_getHeader()
chain_getBlock()
chain_getBlockHash()
chain_getFinalizedHead()
system_syncState()
system_health()
state_getRuntimeVersion(blockhash)
-- author_pendingExtrinsics()

// 周期要求低 10min
---system_peers()
state_getMetadata([blockHash]) 	--》 runtimeversion



// 常量，服务节点启动时更新 or 1day， 节点变更
rpc_methods()
system_name()
system_version() 节点重连更新
system_chain()
system_chainType()
system_properties()


// 链历史数据  history  kv 数据同步问题
chain_getBlock(hash) '0x8caa40fc2c7e7cb9613e5b25ce24c93d14b8625368ea49d9a812ad29eacde879'
chain_getBlockHash(number)  块高度，超出返回错误
chain_getHeader(hash)	// 块hash
state_getStorage(key, blockhash)
state_queryStorageAt(key, blockhash)
--| get_transaction

// 订阅
	author_submitAndWatchExtrinsic 节点直推
	author_unwatchExtrinsic 
	
	chain_subscribeAllHeads 
	chain_unsubscribeAllHeads 
	chain_subscribeNewHeads 
	chain_unsubscribeNewHeads
	chain_subscribeFinalizedHeads 
	chain_unsubscribeFinalizedHeads 
	
	state_subscribeRuntimeVersion 
	state_unsubscribeRuntimeVersion 
	state_subscribeStorage 		// 区块更新就有pub，逐渐增大
	state_unsubscribeStorage

// 禁止
    // 泄露节点信息
    system_nodeROles()
    system_localListenAddresses()
    system_localPeerId()
    
	system_addLogFilter
	system_resetLogFilter
	system_addReservedPeer
	system_removeReservedPeer
	
    // 改变链上数据
    author_insertKey()
    author_rotateKey()
    author_removeExtrinsic
    
    //
    offchain_localStorageSet
    
// 其他，直接走rpc，需要列表筛选判定有效
```

