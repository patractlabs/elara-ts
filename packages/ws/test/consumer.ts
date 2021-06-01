import { Kafka, KafkaConfig } from 'kafkajs'
import { getAppLogger } from 'lib'
const log  = getAppLogger('consumer', true)

const newClient = (host: string[], clientId?: string, config?: KafkaConfig) => {
    return new Kafka({
        ...config,
        brokers: host,
        clientId,
    })
}

const newConsumer = (client: Kafka,) => {
    return {
        consumer: client.consumer({ groupId: 'group-1'}),
        groupId: 'group-1'
    }
}

const consumer = async () => {
    const client = newClient(['127.0.0.1:9092'])

    const consumer = newConsumer(client)
    await consumer.consumer.connect().then(re => {
        log.info('consumer connect')
    })

    consumer.consumer.subscribe({topic: 'elara-sub', fromBeginning: false})

    await consumer.consumer.run({
        partitionsConsumedConcurrently: 5,
        eachMessage: async ({topic, partition, message}) => {
            log.info('topic partition: ', topic, partition)
            log.info('new message: ', message, message.value?.toString())
        }
    })
}

consumer()