import EventEmitter from "events"
import { getAppLogger } from "@elara/lib"

const log = getAppLogger('emiter')

type Listener = (...arg: any[]) => void

export default class Emiter {
    private evt: EventEmitter  = new EventEmitter()

    private evtCnt: number

    private event: string

    constructor(event: string, listener: Listener) {
        this.evtCnt = 0
        this.event = event
        this.evt.once(event, (args: any[]) => {
            log.info(`Event ${event} done`)
            listener(args)
            this.evt.removeAllListeners(event)
        })
    }

    getEvent = (): string => {
        return this.event
    }

    getEvtCount = (): number => {
        return this.evtCnt
    }

    add = (num: number = 1): void => {
        log.info(`add event[${this.event}] count: ${num}`)
        this.evtCnt += num
    }

    done = (args: any[] = []): void => {
        this.evtCnt -= 1
        log.info(`new event ${this.event} emit call, current event count: ${this.evtCnt}`)
        if (this.evtCnt === 0) {
            this.evt.emit(this.event, args)
        }
    }
}