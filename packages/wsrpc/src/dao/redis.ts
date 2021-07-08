import { DBT, Redis, getAppLogger, KEYS } from "elara-lib";

const KCache = KEYS.Cache;
const KChain = KEYS.Chain;

const log = getAppLogger("redis", true);

// TODO redis pool
const chainClient = Redis.newClient(DBT.Chain);
const chainRedis = chainClient.client;

Redis.onError(chainClient);
Redis.onConnect(chainClient);

// pubsub connection only support pub/sub relate command
const chainPSClient = Redis.newClient(DBT.Chain);

Redis.onConnect(chainPSClient);
Redis.onError(chainPSClient);

const cacheClient = Redis.newClient(DBT.Cache);
const cacheRedis = cacheClient.client;

Redis.onConnect(cacheClient);
Redis.onError(cacheClient);

// TODO: refactor by class

namespace Rd {
    // TODO Result typelize

    export const chainPSub = chainPSClient.client;

    /// chain operation
    export const getChainList = async () => {
        return chainRedis.zrange(KChain.zChainList(), 0, -1);
    };

    export const getChainConfig = async (chain: string) => {
        return chainRedis.hgetall(KChain.hChain(chain));
    };

    /// cache operation

    export const setLatest = async (
        chain: string,
        method: string,
        result: any
    ) => {
        // TODO whether expiration
        const updateTime = Date.now();
        const latest = {
            updateTime,
            result,
        };
        log.error("data to be dump: ", latest);
        return cacheRedis.hmset(KCache.hCache(chain, method), latest);
    };

    export const getLatest = async (chain: string, method: string) => {
        return cacheRedis.hgetall(KCache.hCache(chain, method));
    };
}

export default Rd;
