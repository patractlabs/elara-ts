import crypto from 'crypto'
import Dotenv from 'dotenv'
import { Result } from './result'

// common type
export type SNUT = string | null | undefined
export type IDT = string | number       // ID type
export type KCtxT = any       // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type
export type ResultT<T> = Result<T, string>
export type PVoidT = Promise<void>
export type PBoolT = Promise<boolean>
export type PResultT<T> = Promise<Result<T, string>>

// common function
export const isEmpty = (str: SNUT): boolean => {
    if (str === '' || str === null || str === undefined) {
        return true
    }
    return false
}

export const randomId = (size: number = 16): string => {
    return crypto.randomBytes(size).toString('hex')
}

export const md5 = (msg: string): string => {
    const hash = crypto.createHash('md5')
    return hash.update(msg).digest('hex')
}

export const randomReplaceId = (size: number = 16): number => {
    return Buffer.from(crypto.randomBytes(size)).readUIntLE(0, 4)
}

export const delays = (sec: number, cb: () => void) => {
    const timer = setTimeout(() => {
        cb()
        clearTimeout(timer)
    }, sec * 1000);
}

// to use .env and config, init before import config
export const dotenvInit = () => {
    Dotenv.config()
}

//
export * from './api-code'
export * from './api-response'
export * from './chain'
export * from './log'
export * from './mq'
export * from './result'
export * from './redis'
export * from './redis-key'
export * from './rpc'
export * from './unexpect'
export * from './option'
