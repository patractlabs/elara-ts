type SNU = string | null | undefined

export const isEmpty = (str: SNU): boolean => {
    if (str === '' || str === null || str === undefined) {
        return true
    }
    return false
}

import redis from 'ioredis'
export const Redis =  redis