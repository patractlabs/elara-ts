import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import Dotenv from 'dotenv'
Dotenv.config()

console.info('node env in log library: ', process.env.NODE_ENV)

const { combine, colorize, timestamp, label, printf, json, splat } = format

const printFormat = printf(msg => `${msg.timestamp} ${msg.label} ${msg.level}: ${msg.message}`)
const logFormat = (labelStr?: string, isJson: boolean = false) => {
    const common = combine(
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'   // make sure localtime
        }),
        timestamp(),
        label({ label: labelStr ?? '' }),
        splat()
    )
    return combine(common, isJson ? json() : printFormat)
}

function newRotateFile(filename: string, level: string = 'info', isJson: boolean = true) {
    return new DailyRotateFile({
        level,
        filename: `logs/${filename}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        // zippedArchive: true,
        handleExceptions: true,
        json: isJson,
        createSymlink: true,
        symlinkName: `${filename}.log`,
        maxSize: '100m',
        maxFiles: '1d',
    })
}

function consoleLog(label: string, consoleLevel: string) {
    return new transports.Console({
        level: consoleLevel,
        format: combine(colorize(), logFormat(label, false))
    })
}

export function getAppLogger(label: string = '', opt?: { isJson: boolean, consoleLevel: string }) {
    const isJson = opt?.isJson ?? true
    const consoleLevel = opt?.consoleLevel ?? 'debug'
    const format = logFormat(label, isJson)
    let trans: any[] = [newRotateFile('error', 'error'), newRotateFile('app')]
    if (process.env.NODE_ENV === 'dev') {
        trans.push(consoleLog(label, consoleLevel))
    }

    return createLogger({
        format,
        transports: trans,
        exceptionHandlers: [
            newRotateFile('exception', 'error', false)
        ],
        exitOnError: false
    })
}

export function accessLogger() {

    let trans: any[] = [newRotateFile('access', 'http')]
    console.info('node env in log library: ', process.env.NODE_ENV)
    if (process.env.NODE_ENV === 'dev') {
        trans.push(consoleLog('access', 'debug'))
    }
    return createLogger({
        format: logFormat('access', false),
        transports: trans,
        exceptionHandlers: [
            newRotateFile('access-exception', 'error')
        ],
        exitOnError: false
    })
}