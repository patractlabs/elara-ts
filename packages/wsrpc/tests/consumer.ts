import { Subscriber } from '@elara/lib'

const subws = new Subscriber()
const subhttp = new Subscriber()

function run() {
    subws.subscribe('statistic-ws', console.log, 1000)
    subhttp.subscribe('statistic-http', console.log, 1000)

}

run()