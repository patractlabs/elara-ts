/// common type
/// end with 'T'
import { Result } from './types/result'
import Dotenv from 'dotenv'
import Rd from './utils/redis'
import Kfk from './utils/kafka'

export type IDT = string | number       // ID type
export type KCtxT = any       // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type
// export type PResultT = Promise<Result<any, string>>
export type ResultT<T> = Result<T, string>
export type PVoidT = Promise<void>
export type PBoolT = Promise<boolean>
export type PResultT<T> = Promise<Result<T, string>>

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
export const Redis = Rd
export const Kafka = Kfk