import Http from "http";
import { ChainConfig, getAppLogger, isErr } from "elara-lib";
import Dao from "../dao";
import { ReqDataT } from "../interface";
import Util from "../util";
import Puber from "../puber";
import { SuberTyp } from "../matcher/suber";

const log = getAppLogger("noder", true);

const post = (
    chain: string,
    url: string,
    data: ReqDataT,
    resp: Http.ServerResponse
) => {
    const start = Util.traceStart();
    const req = Http.request(
        url,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
            },
        },
        (res) => {
            res.pipe(resp);
            const time = Util.traceEnd(start);
            log.info(
                `new rpc response: chain[${chain}] method ${data.method} time[${time}]`
            );
        }
    );
    req.write(JSON.stringify(data));
    req.end();
};

// TODO: refactor by class

namespace Noder {
    export const sendRpc = async (
        chain: string,
        data: ReqDataT,
        resp: Http.ServerResponse
    ) => {
        log.info(
            `new node rpc requst, chain ${chain} method ${data.method} params ${data.params}`
        );
        const re = await Dao.getChainConfig(chain);
        if (isErr(re)) {
            log.error(`send node rpc request error: ${re.value}`);
            process.exit(2);
        }
        const cconf = re.value as ChainConfig;
        const url = `http://${cconf.baseUrl}:${cconf.rpcPort}`;
        return post(chain, url, data, resp);
    };

    export const sendWs = async (puber: Puber, data: ReqDataT) => {
        log.info(
            `new node ws requst, chain ${puber.chain} method ${data.method} params ${data.params}`
        );
        Puber.transpond(puber, SuberTyp.Node, data);
    };
}

export default Noder;
