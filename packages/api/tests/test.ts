import geo from 'geoip-country'
import Mom from 'moment'
const log = console

const ip = geo.lookup('86.49.252.33')
log.info('ip: ', ip)

type T = Record<string, number>

function statMerge(l: string, r: string): string {
    const lct = JSON.parse(l)
    const rct = JSON.parse(r)
    log.info('ct: ', lct, rct)
    Object.keys(rct).forEach(k => {
        log.info('key: ', k)
        if (Object.keys(lct).includes(k)) {
            lct[k] += rct[k]
        } else {
            lct[k] = rct[k]
        }
    })
    return JSON.stringify(lct)
}

const M: T = {
    'unkonw': 1,
    'US': 2
}

const N: T = {
    'unkonw': 1,
    'US': 2,
    'CN': 10
}

const l = statMerge(JSON.stringify(M), JSON.stringify(N))
log.info('new stat: ', l)

log.info('now hour', Mom().hour())