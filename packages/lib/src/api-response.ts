import { Code, Msg } from './api-code'

export class Resp {
    constructor(public code: Code, public msg: Msg, public data: any) {
        this.code = code
        this.msg = msg
        this.data = data
    }

    static Ok = (data: any = {}) => {
        return new Resp(
            Code.Ok,
            Msg.Ok,
            data
        )
    }

    static Fail = (code: Code, msg: Msg, data: any = {}) => {
        return new Resp(code, msg, data)
    }

    static Unknown = (data: any = {}) => {
        return new Resp(Code.Unknown, Msg.Unknown, data)
    }

    static Whocare = (data: any = {}) => {
        return new Resp(Code.Whocare, Msg.Whocare, data)
    }

    toString() {
        return JSON.stringify(this)
    }

    isOk() {
        return this.code === Code.Ok
    }
}