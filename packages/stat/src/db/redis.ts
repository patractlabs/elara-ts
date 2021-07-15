import Redis, { DBT } from '@elara/lib/utils/redis'

export const statRd = new Redis(DBT.Stat).getClient()

export const projRd = new Redis(DBT.Project).getClient()

export const actRd = new Redis(DBT.Account).getClient()