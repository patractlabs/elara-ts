import { Redis } from 'lib'
const DBT = Redis.DBT
export const statRd = Redis.newClient(DBT.Stat).client

export const projRd = Redis.newClient(DBT.Project).client

export const actRd = Redis.newClient(DBT.Account).client