/// build connection to nodes
/// -- 1. read chain config
/// -- 2. parse rpc strategy
/// -- 3. runtime rpc strategy
/// suber resource manage
/// -- 1. subscription 
/// -- 2. rpc methond cache
import { getAppLogger } from 'lib'
import { Suber } from './interface'

console.log('env: ', process.env.MODE)
const log = getAppLogger('esuber', true)



const esuber = () => {

}

const newSuber = (chain: string, topic: string) => {

}

// system subscription, e.g. lastest block, hash, header
const initSysSuber = async (): Promise<void> => {

    //
}


namespace Suber {
    export const init = esuber
}

export = Suber