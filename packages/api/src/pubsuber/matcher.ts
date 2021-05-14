/// matcher
/// matcher是核心订阅逻辑，负责映射epuber和esuber, 
///             ws          matcher          ws 
///  |-- dapps <--> epuber <=======> esuber <--> node --|

type IDType = string | number


interface Matcher {
    sid: IDType,        // service id, for scale using
    pid: IDType,        // project id, for user project
    chain: string,      // chain name
    topic?: string,     // for subscribe topic
    subid: IDType,      // esuber id
    esuber: WebSocket,  // nodes' ws client,
    pubid: IDType,      // epub id
    epuber: WebSocket,  // dapps' ws server
    option: any         // reserved
}

const registerMatcher = (options: Matcher): void => {
    // 建立pub/sub映射
    // 
}

function unregisterMatcher(sid: IDType, pid: IDType): void {
    // 删除pub/sub映射
    void(sid)
    void(pid)
}

function createClient() {
    // 连接node ws-server
    // 注册matcher
    //
}

function systemSubscriber() {
    // chain_subscribeAllHeads 
	// chain_subscribeNewHeads 
	// chain_subscribeFinalizedHeads 
    // more
}