import { Err, Ok, PResultT } from "elara-lib";
import Rd from "./redis";

// TODO result

// TODO: refactor by class
namespace Dao {
    export const getChainList = async (): PResultT => {
        return Ok(await Rd.getChainList());
    };

    export const getChainConfig = async (chain: string): PResultT => {
        const conf = await Rd.getChainConfig(chain);
        if (!conf.name) {
            return Err("Invalid chain config");
        }
        return Ok(conf);
    };

    export const updateChainCache = async (
        chain: string,
        method: string,
        data: any
    ): PResultT => {
        return Ok(await Rd.setLatest(chain, method, data));
    };

    export const getChainCache = async (chain: string, method: string) => {
        return Rd.getLatest(chain, method);
    };
}

export const chainPSub = Rd.chainPSub;

export default Dao;
