import Application from 'koa'
import * as Logger from 'koa-log4'
import { Configuration } from 'koa-log4'
import Dotenv from 'dotenv'
Dotenv.config()

const env = process.env.NODE_ENV || 'dev'
const outFlag = env === 'dev'

const config: Configuration = {
    appenders: { out: { type: 'console' } },
    categories: { default: { appenders: ['out'], level: 'info' } },
    // pm2: process.env.NODE_ENV !== 'dev' ? true : false
}
const logSize = 10 * 1024 * 1024

export function accessLogger(out: boolean = outFlag): Application.Middleware {
    config.appenders['access'] = {
        type: 'dateFile',
        pattern: '-yyyy-MM-dd.log',
        maxLogSize: logSize,
        // filename: path.join(dir, 'logs/', 'access.log')
        filename: './logs/access.log'
    }

    config.categories['access'] = {
        appenders: out ? ['access', 'out'] : ['access'],
        level: out ? 'debug' : 'info'
    }
    const log4j = Logger.configure(config)
    return Logger.koaLogger(log4j.getLogger('access'))
}

export function getAppLogger(head: string, out: boolean = outFlag): Logger.Logger {
    let heads = `${head}`;
    config.appenders[heads] = {
        type: 'dateFile',
        pattern: '-yyyy-MM-dd.log',
        filename: './logs/app.log', // path.join(dir, 'logs/', 'app.log'),
        maxLogSize: logSize,
        backups: 5, // default 5
        daysToKeep: 0,  // 大于0则删除x天之前的日志
        compress: true,     // 开启gzip压缩
        pm2: true,
        replaceConsole: false,
    }

    config.categories[heads] = {
        // appenders: out ? [heads, 'out'] : [heads], 
        appenders: [heads, 'out'],
        level: out ? 'debug' : 'info'
    }
    return Logger.configure(config).getLogger(heads)
}