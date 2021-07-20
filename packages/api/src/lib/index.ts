import { getAppLogger } from "@elara/lib"
const log = getAppLogger('api-lib')

export function lengthOk(str: string, min: number, max?: number): boolean {
    if (!str) return false
    const len = str.length
    log.debug(`length check: ${len} ${min}-${max}`)
    if (max !== undefined) {
        return len >= min && len <= max!
    }
    log.debug(`length check equal model`)
    return len === min
}