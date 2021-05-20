/// common type
/// end with 'T'
import { Result } from './types/result'

export type IDT = string | number       // ID type
export type KCtxT = any                 // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type
export type PResult = Promise<Result<any, string>>

// types
export * from './types/ApiCode'
export * from './types/ApiResponse'
export * from './types/option'
export * from './types/result'

// utils
export * from './utils/log'


export * from './utils/redis-key'