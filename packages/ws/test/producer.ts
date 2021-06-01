/// kafka2.8

import { CompressionTypes, Kafka, 
    Message, Producer,
    KafkaConfig,
    Consumer,
} from "kafkajs"

import { IDT, getAppLogger } from "lib"
const log = getAppLogger('suducer-mq', true)

const MAX_PARTITION = 6
let GPartitionID = 0

interface SubProto {
    chain: string, 
    topic: string,
    suID: IDT,
    data: any,
}

const geneID = () => {
    return GPartitionID = (GPartitionID + 1) % MAX_PARTITION
}

interface ProducerT {
    client: Producer,
    topic: string
}

interface ConsumerT {
    client: Consumer,
    groupId: string
}


export const newConsumer = (client: Kafka,) => {
    return {
        consumer: client.consumer({ groupId: 'group-2'}),
        groupId: 'group-1'
    }
}

const onConnect = (client: ProducerT | ConsumerT) => {
    client.client.connect().then(re => {
        log.info('client connect successfully: ', re)
    }).catch(err => {
        log.error('client connect error: ', err)
    })
}

interface MsgT {
    chain: string,
    topic: string,
    key: string,
    data: any,
    partition: number
}


namespace  Mq {

    export const newClient = (host: string[], clientId?: string, config?: KafkaConfig) => {
        return new Kafka({
            ...config,
            brokers: host,
            clientId,
        })
    }

    export const newProducer = (client: Kafka, topic: string): ProducerT => {
        return {
            client: client.producer(),
            topic
        }
    }

    export const newMsg = ({ key, chain, topic, data, partition }: MsgT): Message => {
        log.info('new msg partition id: ', partition, GPartitionID)
        return {
            key,
            value: JSON.stringify({
                chain,
                topic,
                data,
            }),
            partition: partition
        }
    }

    export const send = (ducer: ProducerT, msg: Message) => {
        log.info(ducer.topic, msg)
        ducer.client.send({
            topic: ducer.topic,
            compression: CompressionTypes.GZIP,
            acks: 1,
            messages: [msg],
            timeout: 10000, // ms
        }).then(re => {
            log.info('send message result: ', re)
        }).catch(err => {
            log.error('send message error: ', err)
        })
    }
}


const producer = async () => {
    const client = Mq.newClient(['127.0.0.1:9092'])
    const producer = Mq.newProducer(client, 'elara-sub')
    await client.admin().createTopics({topics: [
        { 
            topic: 'elara-sub',
            numPartitions: 6,
        }
    ]})
    
    await producer.client.connect().then(re => {
        log.info('producer connnect')
    })
    setInterval(() => {
        const id = geneID()

        const msg = Mq.newMsg({
            chain: 'polkadot', 
            topic: producer.topic,
            data: {
                name: 'bruce',
                age: 18,
                id
            },
            key: '1',
            partition: id
        })
        Mq.send(producer, msg)
    }, 1000)
}

producer()