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
        // log.info('Project key: %o',key)
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
        // log.info('Project list key: %o',key)
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

    // project status
    export const hProjectStatus = (chain: string, pid: string): string => {
        return `H_${P}_status_${chain.toLowerCase()}_${pid}`
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

    // stat statistic
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
        return `H_${S}_day_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    export const hProHourly = (chain: string, pid: string, timestamp: number): string => {
        return `H_${S}_hour_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    // method statistic
    export const zProBw = (chain: string, pid: string): string => {
        return `Z_Method_bw_total_${chain.toLowerCase()}_${pid}`
    }

    export const zProReq = (chain: string, pid: string): string => {
        return `Z_Method_req_total_${chain.toLowerCase()}_${pid}`
    }

    export const zProDailyBw = (chain: string, pid: string, timestamp: number): string => {
        return `Z_Method_bw_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    export const zProDailyReq = (chain: string, pid: string, timestamp: number): string => {
        return `Z_Method_req_${chain.toLowerCase()}_${pid}_${timestamp}`
    }

    // country request map
    export const zProDailyCtmap = (chain: string, pid: string): string => {
        return `Z_Country_daily_${chain.toLowerCase()}_${pid}`
    }

    // latest normal & error request
    export const zStatList = (): string => {
        return `Z_${S}_list`
    }

    export const zErrStatList = (chain: string, pid: string): string => {
        return `Z_${S}_Err_${chain.toLowerCase()}_${pid}_list`
    }

    export const stat = (chain: string, pid: string, key: string): string => {
        return `${S}_${chain.toLowerCase()}_${pid}_${key}`
    }

    export const errStat = (chain: string, pid: string, key: string): string => {
        return `${S}_Err_${chain.toLowerCase()}_${pid}_${key}`
    }
}

namespace User {
    const U = 'User'

    export const hUser = (uid?: IDT): string => {
        let UID = `${uid}`
        if (isEmpty(uid?.toString())) {
            UID = '*_'
        }
        return `H_${U}_${UID.toLowerCase()}`
    }

    // status 
    export const hStatus = (id: number): string => {
        return `${U}_status_${id}`
    }
}

export const KEYS = {
    Chain,
    Project,
    Cache,
    User,
    Stat
}