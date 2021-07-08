/* eslint-disable @typescript-eslint/no-explicit-any */

/// common type end with 'T'
import { Result } from "@pacote/result";
import Dotenv from "dotenv";
import Rd from "./utils/redis";
import Kfk from "./utils/kafka";

// TODO: remove some types
export type IDT = string | number; // ID type
export type KCtxT = any; // koa.Context
export type NextT = () => Promise<any>; // koa middleware next type
export type PResultT<T> = Promise<Result<T, string>>;
export type ResultT<T> = Result<T, string>;
export type PVoidT = Promise<void>;

// to use .env and config, init before import config
export const dotenvInit = (): void => {
    Dotenv.config();
};

export * as Option from "@pacote/option";
export { Some, None } from "@pacote/option";
export * as Result from "@pacote/result";
export { Ok, Err } from "@pacote/result";
export * from "./types";
export * from "./utils";
export const Redis = Rd;
export const Kafka = Kfk;
