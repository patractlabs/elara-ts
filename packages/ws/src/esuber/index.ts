/// build connection to nodes
/// -- 1. read chain config
/// -- 2. parse rpc strategy
/// -- 3. runtime rpc strategy
/// suber resource manage
/// -- 1. subscription 
/// -- 2. rpc methond cache
import { getAppLogger } from 'lib'

console.log('env: ', process.env.MODE)
const log = getAppLogger('esuber', true)



const esuber = () => {

}

const newSubscriber = () => {

}

// system subscription, e.g. lastest block, hash, header
const initSysSuber = async (): Promise<void> => {

    //
}


namespace ESuber {
    export const init = esuber
}

export = ESuber