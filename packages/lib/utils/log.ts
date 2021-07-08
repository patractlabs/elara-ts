import * as Logger from "koa-log4";
import { Configuration } from "log4js";

const config: Configuration = {
    appenders: { out: { type: "console" } },
    categories: { default: { appenders: ["out"], level: "debug" } },
    // pm2: process.env.NODE_ENV !== 'dev' ? true : false
};
const logSize = 10 * 1024 * 1024;

export function accessLogger(out = false): any {
    config.appenders["access"] = {
        type: "dateFile",
        pattern: "-yyyy-MM-dd.log",
        maxLogSize: logSize,
        // filename: path.join(dir, 'logs/', 'access.log')
        filename: "./logs/access.log",
    };

    config.categories["access"] = {
        appenders: out ? ["access", "out"] : ["access"],
        level: out ? "debug" : "info",
    };
    Logger.configure(config);
    return Logger.koaLogger(Logger.getLogger("access"));
}

export const getAppLogger = (head: string, out = false): any => {
    let heads = `${head}`;
    config.appenders[heads] = {
        type: "dateFile",
        pattern: "-yyyy-MM-dd.log",
        filename: "./logs/app.log", // path.join(dir, 'logs/', 'app.log'),
        maxLogSize: logSize,
        backups: 5, // default 5
        daysToKeep: 0, // 大于0则删除x天之前的日志
        compress: true, // 开启gzip压缩
        pm2: true,
        replaceConsole: false,
    };

    config.categories[heads] = {
        appenders: out ? [heads, "out"] : [heads],
        level: out ? "debug" : "info",
    };
    Logger.configure(config);
    return Logger.getLogger(heads);
};
