import { PResultT, Account, Ok ,Err} from 'lib'
import Rd from './redis'

// TODO return result-type wrap

namespace Dao {
    export const createAccount = async (chain: Account): PResultT => {
        const name = await Rd.haddAccount(chain)
        if (name === null) return Err('')
        return Ok(name)
    }


    export const getAccountDetail = async (uid: string) => {
        return Rd.hgetDetail(uid)
    }

    export const getProjectNum = async (uid: string) => {
        return Rd.scardProjectNum(uid)
    }



}

export default Dao
