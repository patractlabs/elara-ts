export type Stats = Record<string, string | number>
export interface StatT {
    wsReqNum: number,
    wsConn: number,
    wsCt: string,
    wsBw: number,
    wsDelay: number,
    wsInReqNum: number,
    wsTimeout: number,
    wsTimeoutCnt: number,

    httpReqNum: number,
    httpCt: string,
    httpBw: number,
    httpDelay: number,
    httpInReqNum: number,
    httpTimeout: number,
    httpTimeoutCnt: number,
}