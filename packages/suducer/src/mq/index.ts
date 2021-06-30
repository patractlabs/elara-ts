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