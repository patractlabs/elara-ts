const config = {
    keys: ['stat@#^*&'],
    name: 'stat',
    port: 7002,
    session: {
        key: 'sid',
        signed: false,
        maxAge: 2592000000,
        httpOnly: false
    },
    // chain配置统一由chain-server管理
    chain: {
        'polkadot': {},
        'westend': {}
    },
    test: true,
    // redis配置
    redis: {
        host: '127.0.0.1',
        port: '6379',
        password: '***'
    },
    kafka: {
        'kafkaHost': '127.0.0.1:9092',
        'topic': 'elara-dev',
        'consumerGroup': 'elara-stat',
        'sasl': { mechanism: 'plain', username: '***', password: '***' }
    },
    limit: {
        daily: {
            '0': 1000000, //开发者
            '1': 5000000//团队
        },
        project: {//账户下最多项目数
            '0': 20,
            '1': 100
        }
    },
    projects: 100,
    timeout: 5000,// ms
    requests: 1000,//最多保留请求记录
}

interface StatConfig {
    keys: string[]
    port: number
    session: {}
    isTest: boolean
    limit: any
    timeout: number     // ms
    maxProjectNum: number      // 最多项目数
    maxSocketConnNum: number    // 最大ws连接请求   
    maxReqKeepNum: number  //  最多保留的请求数目
}

export const setConfig = (options?: StatConfig): StatConfig => {
    options
    return {
        keys: ['stat@#^*&'],
        port: 7002,
        session: {
            key: 'sid',
            signed: false,
            maxAge: 2592000000,
            httpOnly: false
        },
        isTest: true,
        limit: {
            daily: {
                '0': 1000000, //开发者
                '1': 5000000//团队
            },
            project: {//账户下最多项目数
                '0': 10,
                '1': 1
            }
        },
        maxProjectNum: 100,
        timeout: 5000,// ms
        maxReqKeepNum: 1000,//最多保留请求记录
        maxSocketConnNum: 10
    }
}