import {Code, Msg} from './ApiCode'

export = class Result {
    constructor(public code: Code, public msg: Msg, public data: any) {
        this.code = code
        this.msg = msg
        this.data = data
    }

    static Ok = (data: any = {}) => {
        return new Result(
            Code.Ok,
            Msg.Ok,
            data
        )
    }

    static Fail = (code: Code, msg: Msg, data: any = {}) => {      
        return new Result(code, msg, data)
    }

    toString() {
        return JSON.stringify(this)
    }

    isOk() {
        return this.code === Code.Ok
    }
}