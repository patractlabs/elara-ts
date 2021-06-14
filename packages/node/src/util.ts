import { getAppLogger, Option, Some, None } from 'lib'
import G from './global'
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

    export const sleeps = async (s: number) => {
        return new Promise(resolve=>setTimeout(resolve, s * 1000))
    }

    export const logGlobalStat = () => {
        log.warn('global stat: ', {
            suber: G.suberCnt(),
            puber: G.puberCnt(),
            topic: G.topicCnt(),
            subMap: G.subMapCnt(),
            reqMap: G.reqMapCnt(),
        })
    }
}

export default Util