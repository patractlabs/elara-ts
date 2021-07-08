import { isEmpty } from ".";
type IDT = string | number;

// TODO: refactor by class
namespace Chain {
    const C = "Chain";

    export const chainNum = () => {
        return `${C}_Num`;
    };

    export const hChain = (chain: string): string => {
        return `H_${C}_${chain.toLowerCase()}`;
    };

    export const zChainList = (): string => {
        // score is createTime
        return `Z_${C}_list`;
    };
}

// TODO: refactor by class
namespace Project {
    const P = "Project";

    export const projectNum = () => {
        return `${P}_Num`;
    };

    export const hProject = (chain?: string, pid?: IDT) => {
        let com = `H_${P}_`;
        let CHAIN = "*_";
        let PID = `${pid}`;
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}_`;
        }
        if (isEmpty(pid?.toString())) {
            PID = "*";
        }
        // if chain is empty and pid not, would be get only one
        let key = `${com}${CHAIN}${PID}`;
        // log.info('Project key: ', key)
        return key;
    };

    export const zProjectList = (uid?: IDT, chain?: string): string => {
        let com = `Z_${P}_list_`;
        let CHAIN = "*";
        let UID = `${uid}_`;
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}`;
        }
        if (isEmpty(uid?.toString())) {
            UID = "*_";
        }
        let key = `${com}${UID}${CHAIN}`;
        // log.info('Project list key: ', key)
        return key;
    };
}

// TODO: refactor by class

namespace Cache {
    const C = "Cache";

    export const hCache = (chain: string, method: string) => {
        return `H_${C}_${chain.toLowerCase()}_${method}`;
    };
}

export const KEYS = {
    Chain,
    Project,
    Cache,
};
