import { performance } from "perf_hooks";
import Http from "http";
import { Ok, Err, PResultT, getAppLogger } from "elara-lib";
import Chain from "./chain";

const log = getAppLogger("util", true);
const G = Chain.G;

const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/;
})();

namespace Util {
    export const reqFastStr = (obj: any) => {
        return JSON.stringify(obj);
    };
    // FastStr({
    //     title: 'req schema',
    //     type: 'object',
    //     properties: {
    //         id: { type: 'string' },
    //         jsonrpc: { type: 'string', default: '2.0'},
    //         method: { type: 'string' },
    //         params: { type: 'array', default: [] }
    //     }
    // })

    export const respFastStr = (obj: any) => {
        return JSON.stringify(obj);
    };
    // FastStr({
    //     title: 'resp schema',
    //     type: 'object',
    //     properties: {
    //         id: { type: 'string' },
    //         jsonrpc: { type: 'string', default: '2.0'},
    //         method: { type: 'string' },
    //         result: { type: 'string' },
    //         error: { type: 'object', properties: {
    //             code: { type: 'number' },
    //             message: { type: 'string' }
    //         }}
    //     }
    // })

    export const urlParse = async (url: string): PResultT => {
        const start = traceStart();
        if (UrlReg.test(url)) {
            const parse = UrlReg.exec(url);
            const chain = parse![1].toLowerCase();
            // chain check
            if (!G.hasChain(chain)) {
                return Err(`invalid chain[${chain}]`);
            }
            // pid check
            // TODO
            return Ok({
                chain,
                pid: parse![2],
            });
        }
        const time = traceEnd(start);
        log.info(`url parse time: ${time}`);
        return Err(`Invalid request path`);
    };

    export const traceStart = (): number => {
        return performance.now();
    };

    export const traceEnd = (start: number): string => {
        return (performance.now() - start).toFixed(0) + "ms";
    };

    export const globalStat = () => {
        // return `suber: ${G.suberCnt()}, puber: ${G.puberCnt()}, topic: ${G.topicCnt()}, subMap: ${G.subMapCnt()}, reqMap: ${G.reqMapCnt()}`
    };
}

export namespace Response {
    const end = async (
        res: Http.ServerResponse,
        data: any,
        code: number,
        md5?: string
    ) => {
        res.writeHead(code, {
            "Content-Type": "text/plain",
            Trailer: "Content-MD5",
        });
        res.addTrailers({ "Content-MD5": md5 || "7878" });
        res.write(data);
        res.end();
    };

    export const Ok = async (res: Http.ServerResponse, data: any) => {
        end(res, data, 200);
    };

    export const Fail = async (
        res: Http.ServerResponse,
        data: any,
        code: number
    ) => {
        end(res, data, code);
    };
}

export default Util;
