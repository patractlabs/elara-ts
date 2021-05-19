
export = {
    UID:(uid)=>'USER_'+uid,
    REQUEST_RESPONSE: () => 'request_response',

    TOTAL: (chain) => chain + '_total',    
    DASHBOARD: () => 'dashboard',
    BLACKUID:()=>'block_uid',
    TOTAL_USER:()=>'user_total',

    /// hash
    // 调用方法
    METHOD: (pid, date) => pid + '_method_' + date,   // methods: call num
    // 返回码 200， 500 。。。
    CODE: (pid, date) => pid + '_code_' + date,      // codes: call num
    // 代理
    AGENT: (pid, date) => pid + '_agent_' + date,   // agent same num
    // 原网址
    ORIGIN: (pid, date) => pid + '_origin_' + date, // null same num

    /// string
    // 累计超时，delay大于配置timeout时
    TIMEOUT: (pid, date) => pid + '_timeout_' + date,
    // 累计延迟请求的响应时间
    DELAY: (pid, date) => pid + '_delay_' + date,

    // 请求数
    REQUEST: (pid, date) => pid + '_request_' + date,   // same num
    // 累计带宽
    BANDWIDTH: (pid, date) => pid + '_bandwidth_' + date,
    // 最新请求更新时间
    REQUEST_UPDATETIME: (pid, date) => pid + '_request_updatetime_' + date,
}

