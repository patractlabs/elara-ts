/// common type
/// end with 'T'
import { Result } from './types/result'
import Dotenv from 'dotenv'

export type IDT = string | number       // ID type
export type KCtxT = any                 // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type
export type PResultT = Promise<Result<any, string>>

// to use .env and config, init before import config
export const dotenvInit = () => {
    Dotenv.config()
}

// types
export * from './types/api-code'
export * from './types/api-response'
export * from './types/option'
export * from './types/result'
export * from './types/common-rpc'
export * from './types/chain'

// utils
export * from './utils/log'
export * from './utils/redis-key'