import { isEmpty } from '.'
type IDT = string | number

namespace Chain {
    const C = 'Chain'

    export const chainNum = () => {
        return `${C}_Num`
    }

    export const hChain = (chain: string): string => {
        return `H_${C}_${chain.toLowerCase()}`
    }

    export const zChainList = (): string => {
        // score is createTime
        return `Z_${C}_list`
    }
}

namespace Project {
    const P = 'Project'

    export const hProjecConf = (): string => {
        return `H_${P}_config`
    }

    export const projectNum = (uid?: IDT): string => {
        let UID = `${uid}`
        if (isEmpty(uid?.toString())) { UID = '*' }
        return `${P}_Num_${UID}`
    }

    export const hProject = (chain?: string, pid?: IDT): string => {
        let com = `H_${P}_`
        let CHAIN = '*_'
        let PID = `${pid}`
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}_`
        }
        if (isEmpty(pid?.toString())) {
            PID = '*'
        }
        // if chain is empty and pid not, would be get only one
        let key = `${com}${CHAIN}${PID}`
        // log.info('Project key: ', key)
        return key
    }

    export const zProjectList = (uid?: IDT, chain?: string): string => {
        let com = `Z_${P}_List_`
        let CHAIN = '*_'
        let UID = `${uid}`
        if (!isEmpty(chain)) {
            CHAIN = `${chain?.toLowerCase()}_`
        }
        if (isEmpty(uid?.toString())) {
            UID = '*'
        }
        let key = `${com}${CHAIN}${UID}`
        // log.info('Project list key: ', key)
        return key
    }

    export const hProjectDelete = (uid?: IDT, pid?: IDT): string => {
        const com = `H_${P}_Delete_`
        let UID = `${uid}_`
        let PID = `${pid}`
        if (isEmpty(uid?.toString())) {
            UID = '*_'
        }
        if (isEmpty(pid?.toString())) {
            PID = '*'
        }
        return `${com}${UID}${PID}`
    }

    export const zProjectNames = (uid: IDT, chain: string): string => {
        return `Z_${P}_Name_${chain.toLowerCase()}_${uid}`
    }
}

namespace Cache {
    const C = 'Cache'

    export const hCache = (chain: string, method: string): string => {
        return `H_${C}_${chain.toLowerCase()}_${method}`
    }
}

namespace Stat {
    const S = 'Stat'

    export const hTotal = (): string => {
        return `H_${S}_total`
    }

    export const hChainTotal = (chain: string): string => {
        return `H_${S}_${chain.toLowerCase()}`
    }

    export const hDaily = (): string => {
        return `H_${S}_daily`
    }

    export const hProDaily = (chain: string, pid: string, timestamp: number): string => {
        return `H_${S}_daily_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    export const zStatList = (): string => {
        return `Z_${S}_list`
    }

    export const zExpireList = (): string => {
        return `Z_${S}_expire_timestamp`
    }

    export const zDailyReq = (): string => {
        return `Z_${S}_req_daily`
    }

    export const zDailyBw = (): string => {
        return `Z_${S}_bw_daily`
    }

    export const zReq = (chain: string, pid: string, timestamp: number): string => {
        return `Z_${S}_req_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    export const zBw = (chain: string, pid: string, timestamp: number): string => {
        return `Z_${S}_bw_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    export const stat = (chain: string, pid: string, key: string): string => {
        return `${S}_${chain.toLowerCase()}_${pid}_${key}`
    }

    export const patStat = (chain?: string, pid?: string, key?: string): string => {
        const C = chain?.toLowerCase() ?? '*'
        const P = pid ?? '*'
        const K = key ?? '*'
        return `${S}_${C}_${P}_${K}`
    }
}

namespace Account {
    const A = 'Account'

    export const hAccount = (uid?: IDT): string => {
        let UID = `${uid}`
        if (isEmpty(uid?.toString())) {
            UID = '*_'
        }
        return `H_${A}_${UID.toLowerCase()}`
    }
}

export const KEYS = {
    Chain,
    Project,
    Cache,
    Account,
    Stat
}