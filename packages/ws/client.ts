import Web from 'ws'
import { getAppLogger } from 'lib'
const log = getAppLogger('wsc', true)


const create = (name: string) => {
    let ws = new Web('ws://localhost:80')
    ws.on('open', () => {
        log.info('open')
        ws.send('wtf')
    })
    
    ws.on('close', (code, err) => {
        log.error('close: ', code, err)
        ws.close()
        setTimeout(() => {
            create(name)
        }, 3000)
    })

    ws.on('error', (err) => {
        log.error('error: ', err)
    })
}

create('Bruce')