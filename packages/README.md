## `elara-ts`项目设计

按服务模块分包，每个包相当于一个微服务。包内项目推荐按照组件原则构建，而不是`MVC`。

#### 组织结构

##### 项目结构

```js
pakages
|___chain		// 平行链服务，动态管理链
|___gateway		// api网关
|___job			// 定时任务等
|___stat		// elara数据统计，项目统计
|___lib			// 公共库
|___ws			// elara核心服务，rpc请求，ws订阅管理
|___account		// 账户管理，认证

```

##### 包结构

```js
ws
|___logs						// 输出日志
|___config						// 配置
	|___default.json			// common config
	|___dev.json				// NODE_ENV === dev, development
	|___pro.json				// NODE_ENV === pro， production
	|___test.json				// NODE_ENV === test，所有环境配置应与pro相同
|___src	
	|___lib						// 内部公共库
	|___esuber					// esuber组件
		|___global.ts			// global变量定义
		|___interface.ts		// 数据结构
		|___index.ts			// 导出，初始化，组件入口
		|___suber.test.ts		// 组件测试
	|___epuber
	|___matcher
|___test						// 集成测试
|___package.json
|___tsconfig.json
|___pm2.json
|___.gitignore
```

#### 命名规范

- 公共导出类型以 `CapTypeT`格式，以`T`结尾
- 全局共享变量，模块共享变量均以命名空间 `G`导出
- 导出方式以文件夹，而不是文件，即文件夹下`index.ts`统一导出
- 编码优先函数组件式而不是类
- 能使用`const`的尽量不用`let`，禁止`var`

