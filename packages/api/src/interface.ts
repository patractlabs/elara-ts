export type Stats = Record<string, string|number>
export interface StatT {
    wsReqNum: string,
    wsConn: string,
    wsCt: string,   
    wsBw: string,
    wsDelay: string,
    wsInReqNum: string,
    wsTimeout: string,
    wsTimeoutCnt: string,

    httpReqNum: string,
    httpCt: string,
    httpBw: string,
    httpDelay: string,
    httpInReqNum: string,
    httpTimeout: string,
    httpTimeoutCnt: string,
}