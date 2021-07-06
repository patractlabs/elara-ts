import Chain from "./chain"
import Matcher from "./matcher"

namespace Service {
    export const init = async () => {
        await Chain.init()
        Matcher.init()
    }
}

export default Service