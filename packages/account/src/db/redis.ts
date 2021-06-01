import { Redis } from 'lib/utils'

export const statRd = new Redis({
    db: 2
})

export const projRd = new Redis({
    db:1
})

export const actRd = new Redis({
    db: 0
})
