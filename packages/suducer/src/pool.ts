/// ws pool management
/// 1. a ws normalize queen   [ws1, ws2, ...]
/// 2. a ws Suducer-binding map { chain: {chan: {id1: Suducer}, rpc: {id2: Suducer}}}, current choose.

import WebSocket from "ws";
import EventEmitter from "events";
import {
    Ok,
    Err,
    PResultT,
    ChainConfig,
    getAppLogger,
    IDT,
    Result,
    Option,
    DBT,
    Producer,
    dotenvInit,
} from "elara-lib";
import { G } from "./global";
import { ReqT, TopicT } from "./interface";
import Dao from "./dao";
import Suducer, { SuducerStat, SuducerT } from "./suducer";
import Service from "./service";
import Conf from "../config";

dotenvInit();

const log = getAppLogger("pool", true);

const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb();
        clearTimeout(timer);
    }, sec * 1000);
};

const generateUrl = (url: string, port: number, sec = false) => {
    let procol = "ws://";
    if (sec) {
        procol = "wss://";
    }
    return `${procol}${url}:${port}`;
};

const rdConf = Conf.getRedis();
log.warn(
    `current env ${process.env.NODE_ENV} redis conf: `,
    JSON.stringify(rdConf)
);
const pro = new Producer({
    db: DBT.Pubsub,
    arg: { host: rdConf.host, port: rdConf.port },
});

const SubReg = (() => {
    return /[0-9a-zA-Z]{16}/;
})();

const isSubID = (id: string): boolean => {
    return SubReg.test(id) && id.length === 16;
};

type SuducerArgT = {
    chain: string;
    url: string;
    type: SuducerT;
    topic?: string;
};
const newSuducer = ({ chain, url, type, topic }: SuducerArgT): Suducer => {
    const ws: WebSocket = new WebSocket(url);
    let top;
    if (type === SuducerT.Sub) {
        top = {
            topic,
            params: [],
        } as TopicT;
    }
    let suducer: Suducer = Suducer.create(chain, type, ws, url, top);
    // log.info(`create new suducer: ${JSON.stringify(suducer)}`)
    const sign = `Chain[${chain}]-Url[${url}]-Type[${type}]-ID[${suducer.id}]`;

    ws.once("open", () => {
        log.info(`Suducer ${sign} opened`);

        // set the status ok
        suducer.stat = SuducerStat.Active;
        G.updateSuducer(suducer);

        // decr pool cnt
        G.decrPoolCnt(chain, type);
        if (G.getPoolCnt(chain, type) === 0) {
            // emit init done event
            let evt = G.getPoolEvt(chain, type);
            if (!evt) {
                log.error(
                    `get pool event of chain ${chain} type ${type} error`
                );
                process.exit(2);
            }
            evt.emit("open");
            log.info(`emit pool event done of chain ${chain} type ${type}`);
        }
    });

    ws.on("error", (err: Error) => {
        log.error(`Suducer err-evt ${sign}: `, err);
    });

    ws.on("close", (code: number, reason: string) => {
        log.error(
            `Suducer close-evt ${sign}: `,
            code,
            reason,
            suducer.ws.readyState
        );

        if (type === SuducerT.Cache) {
            // G.delInterval(chain, CacheStrategyT.SyncAsBlock)
            let size = Conf.getServer().cachePoolSize;
            if (G.getPoolCnt(chain, type) < size) {
                G.incrPoolCnt(chain, type);
            }
        }
        // keep the topic try to recover

        let evt = G.getPoolEvt(chain, type);
        if (!evt) {
            log.error(`get event error: chain ${chain} type[${type}]`);
            process.exit(2);
        }

        let close = evt.listeners("close");
        log.warn(`close event listener: ${close}`);

        Pool.del(chain, type, suducer.id!);

        // set pool subscribe status fail
        delays(3, () => Pool.add({ chain, url, type, topic }));
    });

    ws.on("message", async (data: WebSocket.Data) => {
        const dat = JSON.parse(data.toString());
        // cache data
        if (dat.id) {
            const isCacheReq = (dat.id as string).startsWith("chain");
            if (isCacheReq) {
                let pat = dat.id.split("-");
                const chain = pat[1];
                const method = pat[2];
                //
                log.info(`cache message： chain ${chain} method[${method}]`);
                Dao.updateChainCache(chain, method, dat.result);
            } else if (isSubID(dat.result)) {
                // first subscribe response
                log.info(
                    `first subscribe response chain ${chain} topic[${topic}]`
                );
                // G.addSubTopic(chain, dat.result, method)
                let re: any = G.getSuducerId(chain, topic!);
                if (Option.isNone(re)) {
                    log.error(
                        `get suducer id error: invalid chain ${chain} method ${topic}`
                    );
                    process.exit(2);
                }
                const sudId = re.value;
                re = G.getSuducer(chain, type, sudId);
                if (Option.isNone(re)) {
                    log.error(
                        `get suducer error: chain ${chain} type[${type}] id[${sudId}]`
                    );
                    process.exit(2);
                }
                let suducer = re.value as Suducer;
                suducer.topic = { ...suducer.topic, id: dat.result } as TopicT;
                G.updateSuducer(suducer);
            }
        }
        // subscribe data
        else if (dat.params) {
            // second response
            // log.info(`new subscribe data: ${JSON.stringify(dat.params)}`)

            const method = topic!;
            pro.publish(`${chain}-${method}`, [
                method,
                JSON.stringify(dat.params.result),
            ]);

            if (method === "state_subscribeRuntimeVersion") {
                // update syncOnce
                log.warn(`runtime version update`);
                Dao.updateChainCache(chain, method, dat.params.result);
                Service.Cacheable.syncOnceService(chain);
            }
        }
    });

    return suducer;
};

// TODO: refactor by class
namespace Pool {
    export const add = (arg: SuducerArgT) => {
        let { chain, url, type, topic } = arg;

        const suducer = newSuducer({ chain, url, type, topic });
        G.addSuducer(suducer);
        if (type === SuducerT.Sub) {
            G.addTopicSudid(chain, topic!, suducer.id);
        }
    };

    export const del = (chain: string, type: SuducerT, sudId: IDT) => {
        G.delSuducer(chain, type, sudId);
        if (type === SuducerT.Sub) {
            G.delTopicSudid(chain, type);
        }
    };

    const selectSuducer = async (
        chain: string,
        type: SuducerT,
        method?: string
    ): PResultT => {
        let suducer: Suducer;

        if (type === SuducerT.Cache) {
            let re = G.getSuducers(chain, type);
            if (Option.isNone(re)) {
                return Err(`no suducer of chain ${chain} type ${type}`);
            }
            // TODO: robin
            const suducers = re.value;
            suducer = suducers[Object.keys(suducers)[0]];
        } else if (type === SuducerT.Sub) {
            let re: Option<any> = G.getSuducerId(chain, method!);
            if (Option.isNone(re)) {
                return Err(`no suducer id of chain ${chain} topic[${method}]`);
            }

            re = G.getSuducer(chain, type, re.value);
            if (Option.isNone(re)) {
                return Err(`no suducer of chain ${chain} type ${type}`);
            }
            suducer = re.value;
        } else {
            return Err(`no this suducer of type ${type}`);
        }
        return Ok(suducer);
    };

    export const send = async (chain: string, type: SuducerT, req: ReqT) => {
        // select suducer according to chain & type
        let re = await selectSuducer(chain, type, req.method);
        if (Result.isErr(re)) {
            log.error(
                `select suducer error: no ${type} suducer of chain ${chain} method [${req.method}] valid`
            );
            process.exit(2);
        }
        const suducer = re.value as Suducer;
        if (!suducer || !suducer.ws) {
            log.error(
                `socket has been closed: chain ${chain} type[${type}] method[${req.method}]`
            );
            return;
        }
        suducer.ws.send(JSON.stringify(req));
        log.info(
            `chain ${chain} type ${type} send new request: ${JSON.stringify(
                req
            )} `
        );
    };

    export const isSuducerOk = (suducer: Suducer): boolean => {
        return suducer.stat === SuducerStat.Active;
    };

    const cachePoolInit = (chain: string, url: string) => {
        const type = SuducerT.Cache;
        const size = Conf.getServer().cachePoolSize;
        G.setPoolEvt(chain, type, new EventEmitter());
        G.setPoolCnt(chain, type, size);
        add({ chain, url, type });
    };

    const subPoolInit = (chain: string, url: string) => {
        const type = SuducerT.Sub;
        const topics = G.getSubTopics();
        G.setPoolCnt(chain, type, Object.keys(topics).length);
        G.setPoolEvt(chain, type, new EventEmitter());
        for (let topic of topics) {
            add({ chain, url, type, topic });
        }
    };

    export const init = (secure: boolean = false) => {
        // init pool for basic sub & chan connection
        const cconf = G.getAllChainConfs();
        const re = G.getAllChains();

        if (Option.isNone(cconf) || Option.isNone(re)) {
            log.error(`no chains available`);
            return;
        }
        const chains = re.value;
        const chainConf = cconf.value;
        for (let chain of chains) {
            const conf = chainConf[chain] as ChainConfig;

            const url = generateUrl(conf.baseUrl, conf.wsPort, secure);

            cachePoolInit(chain, url);

            subPoolInit(chain, url);
        }
    };
}

export default Pool;
