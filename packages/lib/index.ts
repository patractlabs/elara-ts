/// common type
/// end with 'T'

export type IDT = string | number       // ID type
export type KCtxT = any                 // koa.Context
export type NextT = () => Promise<any>  // koa middleware next type

// types
export * from './types/ApiCode'
export * from './types/ApiResponse'

// utils
export * from './utils/log'