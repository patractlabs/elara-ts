import { getAppLogger, Option, Some, None } from 'lib'
import { ChainPidT } from './interface'

const log = getAppLogger('util', true)

// /chain/pid
const UrlReg = (() => {
    return /^\/([a-zA-Z]{4,20})\/([a-z0-9]{32})$/
})()


namespace Util {
    export const urlParse = (url: string): Option<ChainPidT> => {
        if (UrlReg.test(url)) {
            const parse = UrlReg.exec(url)
            return Some({
                chain: parse![1].toLowerCase(),
                pid: parse![2]
            })
        }
        log.error('Invalid url path: ', url)
        return None
    }

    export const ldel = (lis: any[], value: any) => {
        return lis.filter((val) => {
            return val !== value
        })
    }
}

export default Util