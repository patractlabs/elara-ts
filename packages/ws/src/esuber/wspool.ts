import { getAppLogger } from 'lib'
import Conf from '../../config'

const log = getAppLogger('suber-p', true)

export const wspoolInit = () => {
    // read pool config
    // init pool 
    const pool = Conf.getWsPool()
    log.info('ws pool config: ', pool)
    for (let i = 0; i < pool.sub; i++) {
    }

    for (let i = 0; i < pool.chan; i++) {

    }
}