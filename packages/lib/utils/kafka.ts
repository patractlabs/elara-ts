import * as kafka from 'kafka-node'
import { KafkaClientOptions, KafkaClient } from 'kafka-node'

const Producer = kafka.Producer
const client = new kafka.KafkaClient({})

export type AnyCb = (err: any, data: any) => any


export const newMsgs = (key: string, value?: string): string[]|kafka.KeyedMessage[] => {
    if (value) {
        return [new kafka.KeyedMessage(key, value)]
    }
    return [key]
}

/**
 * 
 * @param payloads 
 * {
 *      topic: ''
 *      messages: [string|KeyedMessage],
 *      key: ''
 *      partition: 0// default
 *      attributes: 2// default 0 ,0-no compression 1- compress-gzip 2-compress-snappy
 * }
 */
export const sendMsg = (payloads: kafka.ProduceRequest[], cb: AnyCb): void => {
    // TODO
}

// client
// { kafkaHost: string, sa}
export function newClient(options: KafkaClientOptions) {
    return new kafka.KafkaClient(options)
}

// clietn create topic
/**
 * 
 * @param topics [{
 *  topic: ''
 *  partitions: 1,
 *  replicationFactor: 2
 *  congiEntries: [{name: 'compress.type', value: 'gzip'}]
 *  replicaAssignment: [{partitions: 0, replicas: [2, 1]}]
 * ]
 */
function createTopic(topics: kafka.CreateTopicRequest[]) {

    client.createTopics(topics, () => {})
}

// producer factory
export const newProducer = (client: KafkaClient):kafka.Producer => {
    return new Producer(client, {
        partitionerType: 1
    })
}

// producer events 
// producer.on('ready', () => { // ready to send message }); 
// producer.on('error', () => { // somethind bad haapen })

// send(payloads, cb)

// consumer factory
export const newConsumer = ():void => {

}