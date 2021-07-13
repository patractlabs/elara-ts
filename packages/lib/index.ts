/// common type end with 'T'
import { Result } from './types/result'
import Dotenv from 'dotenv'

export type IDT = string | number       // ID type
export type KCtxT = any       // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type
export type ResultT<T> = Result<T, string>
export type PVoidT = Promise<void>
export type PBoolT = Promise<boolean>
export type PResultT<T> = Promise<Result<T, string>>

// to use .env and config, init before import config
export const dotenvInit = () => {
    Dotenv.config()
}

// types
export * from './types'

// utils
export * from './utils'