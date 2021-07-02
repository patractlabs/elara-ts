/// matcher
/// matcher是核心订阅逻辑，负责映射epuber和esuber, 
///             ws          matcher          ws 
///  |-- dapps <--> epuber <=======> esuber <--> node --|
import { getAppLogger } from 'lib'
const log = getAppLogger('matcher', true)
type IDType = string | number

log.info()
export interface Matcher {
    sid: IDType,        // service id, for scale using
    pid: IDType,        // project id, for user project
    chain: string,      // chain name
    topic?: string,     // for subscribe topic
    subid: IDType,      // esuber id
    esuber: WebSocket,  // nodes' ws client,
    pubid: IDType,      // epub id
    epuber: WebSocket,  // dapps' ws server
    option: any         // reserved
}
