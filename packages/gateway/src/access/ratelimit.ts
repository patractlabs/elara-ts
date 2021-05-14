//! 限流管理
//! TODO
//! 1. 针对路由进行配置
//! 2. 黑白名单管理
//! 3. 存储配置- redis或者in-memory
//! 4. 限流参数配置
//! 5. 降级熔断

import rate from 'koa-ratelimit'

const db = new Map()

export const ratelimit = ():any => {
    return rate({
        driver: 'memory',
        db,
        duration: 10000,
        errorMessage: "Jack slow fuck!",
        id: (ctx) => ctx.ip,
        headers: {
            remaining: 'Rate-Limit-Remainning',
            reset: 'Rate-Limit-Reset',
            total: 'Rate-Limit-Total'
        },
        max:10,
        disableHeader: false,
        // whitelist: (ctx: Koa.Context):boolean => {
        //     // if true, skip ratelimit check
        //     console.log("ctx: ", ctx)
        //     // if (ctx.request)
        //     return true
        // },
        // blacklist: (ctx) =>{
        //     // same above
        //     return true
        // }
    })
}

// white list filter

// black list filter