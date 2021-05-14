
// rpc 请求数据格式
interface ReqMsg {
    protocol: string,
    header: string,
    ip: string,
    pid: string,
    method: string,
    req: string,
    resp: string,
    code: number,
    bandwidth: number,
    start: number,
    end: number
}