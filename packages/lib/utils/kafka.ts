/// partition ID: generate by chain to load balance
/// group ID: 
/// consumer partitionsConsumedConcurrently: > 1, 
///   (topic, chain) => handle message
///
/// const kafka = new Kafka({
///    logLevel: logLevel.DEBUG,
///    brokers: [`${host}:9092`],
///    clientId: 'elara',
///    connectionTimeout: 3000,  // default 1000 ms
///    requestTimeout: 15000,    // default 30000
///    retry: {
///        initialRetryTime: 300,  // default 300 ms
///      retries: 8, // defult 5
///    }
///    // sasl: ''
/// })


import {
    Kafka, CompressionTypes,
    KafkaConfig,
    Producer,
    Consumer,
    Message,
    Admin
} from 'kafkajs'

import {  None, Option, Some } from "../types/option"
import { getAppLogger } from './log'

const log = getAppLogger('kafka', true)

namespace  Kfk {

    let MAX_PARTITION: number = 6
    let GPartitionID: number = 0

    export interface KafkaT {
        c: Kafka,
        clientId: string,
    }

    export interface ProducerT {
        c: Producer,
        topic: string
    }

    export interface ConsumerT {
        c: Consumer,
        groupId: string
    }

    export const newClient = (host: string[], clientId?: string, config?: KafkaConfig): KafkaT => {
        return {
            c: new Kafka({
                ...config,
                brokers: host,
                clientId,
            }),
            clientId: clientId || 'KfkClient'
        }
    }

    export const newTopicProducer = (client: KafkaT, topic: string): ProducerT => {
        return {
            c: client.c.producer(),
            topic
        }
    }

    export const newProducer = (client: KafkaT): Producer => {
        return client.c.producer()
    }
    
    export const newConsumerGroup = (client: KafkaT, groupId: string): ConsumerT => {
        return {
            c: client.c.consumer({ groupId }),
            groupId
        }
    }

    export const newConsumer = (client: KafkaT): Consumer => {
        return client.c.consumer()
    }

    export const onConnect = (procon: ProducerT | ConsumerT): void => {
        const client = (procon as ProducerT).topic ? 'Producer' : 'Consumer'
        const topgr = client === 'Producer' ? (procon as ProducerT).topic : (procon as ConsumerT).groupId

        procon.c.connect().then(re => {
            log.info(`${client} client connect [${topgr}] successfully : `, re)
        }).catch(err => {
            log.error(`${client} client connect [${topgr}] error: `, err)
        })
    }

    export const newTopic = (chain: string, method: string): string => {
        // valid char `. _ -`
        return `${chain.toLowerCase()}-${method}`
    }

    export const newMsg = (data: any, key?: string, partition: number = 0): Message => {
        log.info('new msg partition id: ', partition)
        return {
            key,
            value: JSON.stringify(data),
            partition: partition
        }
    }

    export const send = (ducer: ProducerT, msg: Message, cb?: (re: Option<any>, err: any) => void) => {
        log.info(ducer.topic, msg)
        ducer.c.send({
            topic: ducer.topic,
            compression: CompressionTypes.GZIP,
            acks: 1,
            messages: [msg],
            timeout: 10000, // ms
        }).then(re => {
            log.info(`send topic[${ducer.topic}] message result: `, re)
            cb && cb(Some(re), None)
        }).catch(err => {
            log.error(`send topic[${ducer.topic}] message error: `, err)
            cb && cb(None, Some(err))
        })
    }

    // admin
    export const newAdmin = (client: Kafka) => {
        return client.admin()
    }

    export const createTopic = (admin: Admin, topic: string, numPartitions: number) => {
        admin.createTopics({
            topics: [{topic, numPartitions}]
        })
    }

    // util
    export const getMaxPartition = (): number => {
        return MAX_PARTITION
    }
    export const setMaxPartition = (max: number) => {
        MAX_PARTITION = max
    }
    export const geneID = (): number => {
        return GPartitionID = (GPartitionID + 1) % MAX_PARTITION
    }
}

export default Kfk