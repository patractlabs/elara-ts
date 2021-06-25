/// partition ID: generate by chain to load balance
/// group ID: 
/// consumer partitionsConsumedConcurrently: > 1, 
///   (topic, chain) => handle message
///
import { Kafka, getAppLogger } from 'lib'

const log = getAppLogger('kafka', true)

namespace  Mq {

    const client = Kafka.newClient(['127.0.0.1:9092'], 'suducer')

    export const producer = Kafka.newProducer(client)

    producer.connect().then(re => {
        log.info('Producer connect successfully: ', re)
    }).catch(err => {
        log.error('Producer connect error: ', err)
    })
}

export default Mq