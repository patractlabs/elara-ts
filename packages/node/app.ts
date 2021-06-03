import { getAppLogger } from 'lib'
import Puber from './src/puber'
import Suber from './src/suber'

const log = getAppLogger('Node', true)


const run = async () => {
    await Suber.init()
    Puber.init()
}

run()