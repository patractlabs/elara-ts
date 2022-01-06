## Elara v2.0

Elara typescript reconstruction.

Elara is inspired by Infura from the Ethereum ecosystem, named after Jupiter’s seventh moon.  Elara's goal is to build a similar infrastructure and network public  access services to provide developers with a unified access layer based  on Substrate multi-chain. In addition, Elara will be used as part of the smart contract development service, and will be integrated with other  components of the Patract toolchain in the future, in terms of contract  development environment support, development tools component, contract  deployment and Dapp release. Elara will be Polkadot’s infrastructure,  allowing developers to focus on building upper-level applications.

Riot Group for disscusion: https://app.element.io/#/room/#PatractLabsDev:matrix.org

### Elara service

#### wsrpc

Wsrpc is Elara core service.

#### suducer

Suducer is Elara cache service. 

#### api

Elara api service.

#### job

Elara statistic job service.

### How to use

You can visit [elara's official website](https://elara.patract.io)  to get your endpoint by creating a project. You can also directly access [polkadotapps](https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fpolkadot.elara.patract.io#/explorer) and select support elara chain  to use a public connection, but the connection has share resource restrictions.

If you want to deploy your own elara service for node service. **Redis ^5** and **Postgresql** is required.

#### Install

```
nodejs ^14
yarn
```

#### Configure

If you wanna run Elara front-end, see [here](https://github.com/patractlabs/elara-website). Elara-Api and Elara-Job service are responsible for Elara front-end service. 

##### Api service

```
create packages/api/.env file like packages/api/.env.example
generate your own AUTH with base64 encoder from Job service AUTH string
NO_AUTH true for local test without auth check
```

##### Job service

```
create packages/api/.env file like packages/job/.env.example
create your own AUTH string, which is used for Api service
```

Configure your own **Redis** and **Postgresql** connection for each service on `packages/[service]/config/*.json` according to your `NODE_ENV` environment.

#### Build

At the root workspace, run

```
yarn install
yarn build
```

It's done. All the service will build into `packages/[service]/dist`.

#### Initiate

Before running Elara service, you should initiate the chain relate resource. see `packages/script/redis_init.ts`

If you want [Elara-kv](https://github.com/patractlabs/elara-kv-component) support, set `kvEnable` true.

#### Run

Run in ts-node

```js
yarn wsrpc start
yarn suducer start
yarn api start
yarn job start
```

Run in nodejs.

```js
yarn wsrpc start:node
yarn suducer start:node
yarn api start:node
yarn job start:node
```

All the RPC request follow the rules:

```
url/[chain]/[pid]
```