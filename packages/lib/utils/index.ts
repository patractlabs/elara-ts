import crypto from 'crypto'

type SNU = string | null | undefined

export const isEmpty = (str: SNU): boolean => {
    if (str === '' || str === null || str === undefined) {
        return true
    }
    return false
}

export const randomId = (size: number = 16): string => {
    return crypto.randomBytes(size).toString('hex')
}

export const md5 = (msg: string) => {
    const hash = crypto.createHash('md5')
    return hash.update(msg).digest('hex')
}

export const randomReplaceId = (size: number = 16): number => {
    return Buffer.from(crypto.randomBytes(size)).readUIntLE(0, 4)
}

import redis from 'ioredis'
export const Redis =  redis