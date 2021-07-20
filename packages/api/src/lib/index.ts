export function lengthOk(str: string, min: number, max?: number): boolean {
    if (!str) return false
    const len = str.length
    if (!max) {
        return len >= min && len <= max!
    }
    return len === min
}