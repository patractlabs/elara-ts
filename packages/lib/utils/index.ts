import crypto from "crypto";
// utils
export * from "./log";
export * from "./kafka";
export * from "./mq";
export * from "./redis";
export * from "./redis-key";

type SNU = string | null | undefined;

export function isEmpty(str: SNU): boolean {
    if (str === "" || str === null || str === undefined) {
        return true;
    }
    return false;
}

export function randomId(size = 16): string {
    return crypto.randomBytes(size).toString("hex");
}

export function md5(msg: string): string {
    const hash = crypto.createHash("md5");
    return hash.update(msg).digest("hex");
}

export function randomReplaceId(size = 16): number {
    return Buffer.from(crypto.randomBytes(size)).readUIntLE(0, 4);
}

export function delays(sec: number, cb: () => void): void {
    const timer = setTimeout(() => {
        cb();
        clearTimeout(timer);
    }, sec * 1000);
}
