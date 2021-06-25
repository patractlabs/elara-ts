import { IDT } from '../../lib'

export interface Account {
    uid: IDT
    username: IDT
    vip: number
    type: string
    createTime: number | string
    apikey: string
    [key: string]: any
}

export const toAccountJsonstr = (account: Account): string => {
    return JSON.stringify(account)
}

export const toAccount = (account: string): Account => {
    return JSON.parse(account)
}