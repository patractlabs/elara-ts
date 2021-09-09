import { getAppLogger } from '@elara/lib'
import { ReqDataT, Statistics } from "../interface"
import { SuberTyp } from "../matcher/suber"
import Puber from "../puber"

const log = getAppLogger('kver')

class Kver {
    // static Rpcs: string[] = []

    static Rpcs: string[] = [
        "chain_subscribeAllHeads",          // chain_allHead
        "chain_subscribeFinalisedHeads",    // chain_finalizedHead
        "chain_subscribeFinalizedHeads",    // chain_finalizedHead
        "chain_subscribeNewHead",           // chain_newHead
        "chain_subscribeNewHeads",          // chain_newHead
        "chain_subscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_subscribeJustifications",  // grandpa_justifications

        "state_subscribeRuntimeVersion",    // state_runtimeVersion
        "state_subscribeStorage",           // state_storage

        "chain_unsubscribeAllHeads",          // chain_allHead
        "chain_unsubscribeFinalisedHeads",    // chain_finalizedHead
        "chain_nusubscribeFinalizedHeads",    // chain_finalizedHead
        "chain_unsubscribeNewHead",           // chain_newHead
        "chain_unsubscribeNewHeads",          // chain_newHead
        "chain_unsubscribeRuntimeVersion",    // chain_runtimeVersion

        "grandpa_unsubscribeJustifications",  // grandpa_justifications

        "state_unsubscribeRuntimeVersion",    // state_runtimeVersion
        "state_unsubscribeStorage"           // state_storage
    ]

    static send(puber: Puber, data: ReqDataT, stat: Statistics): void {
        log.info(`new kv request, chain ${puber.chain} method ${data.method} params `, data.params)
        Puber.transpond(puber, SuberTyp.Kv, data, stat)
    }
}

export default Kver