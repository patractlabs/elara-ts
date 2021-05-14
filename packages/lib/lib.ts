import * as path from 'path'

export const filName = (fil: string): string  => {
    return path.basename(fil, '.ts')
}