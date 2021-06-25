//! elara服务订阅管理器
//! 分为matcher、e-client、e-server三个部分。epuber相对于dapps的elara pub服务端，esuber相对于同步节点的elara sub客户端。

//! TODO
//! 1. matcher algo
//! 2. 资源管理，dapps异常，elara服务异常，节点异常情况下，资源如何释放和重分配

//! 3. dapps异常，释放epuber连接；如果该订阅服务是最后一个，释放esuber连接。
//!    dapp重新连接时，分配已有的资源，不重新建立新连接

//! 4. node异常，释放esuber连接。若可从新申请，则申请新的资源映射；
//!    若不行则释放epuber连接？

//! 5. elara异常，恢复已申请的资源？是否持久化资源状态
//! 6. scale algo，负载均衡，连接维持
//!

const setup = () => {
    
}