import { Redis } from 'lib'
const DBT = Redis.DBT

export const statRd = Redis.newClient(DBT.Stat)

export const projRd = Redis.newClient(DBT.Project)

export const actRd = Redis.newClient(DBT.Account)