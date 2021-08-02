import ChainConfigModel from '../models/chain-config'
import { getAppLogger } from '@elara/lib'

const log = getAppLogger('chain-config')

export default class ChainConfig {
    static async add() {
        const re = await ChainConfigModel.create({
            serverId: 0,
            baseUrl: '127.0.0.1',
            rpcPort: 9933,
            wsPort: 9944,
            kvEnable: false,
            chainId: 1
        })
        log.debug('create chain config: ', re)
    }
}