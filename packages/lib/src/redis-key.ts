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

    export const projectNum = (uid?: IDT) => {
        let UID = `${uid}`
        if (isEmpty(uid?.toString())) { UID = '*'}
        return `${P}_Num_${UID}`
    }

    export const hProject = (chain?: string, pid?: IDT) => {
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

    export const hCache = (chain: string, method: string) => {
        return `H_${C}_${chain.toLowerCase()}_${method}`
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
    Account
}