// producer consumer broker
// broker server:
// 1. message ack
// 2. pending retry
// 3. request queue   
// 4. balance load 
// 5. scaling 

interface Producer {
    send: ({}: any) => Promise<any>
}

interface Mq {
    producer: any
}

namespace Mq {

    export const producer = {} as Producer

}

export default Mq