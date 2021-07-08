/* eslint-disable @typescript-eslint/no-explicit-any */
import { Code, Msg } from "./api-code";

export class Resp {
    constructor(public code: Code, public msg: Msg, public data: any) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }

    static Ok(data: any = {}): Resp {
        return new Resp(Code.Ok, Msg.Ok, data);
    }

    static Fail(code: Code, msg: Msg, data: any = {}): Resp {
        return new Resp(code, msg, data);
    }

    static Unknown(data: any = {}): Resp {
        return new Resp(Code.Unknown, Msg.Unknown, data);
    }

    static Whocare(data: any = {}): Resp {
        return new Resp(Code.Whocare, Msg.Whocare, data);
    }

    toString(): string {
        return JSON.stringify(this);
    }

    isOk(): boolean {
        return this.code === Code.Ok;
    }
}
