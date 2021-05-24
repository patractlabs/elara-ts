import { Redis } from 'lib/utils'

export const chainRd = new Redis({
    db: 3
})