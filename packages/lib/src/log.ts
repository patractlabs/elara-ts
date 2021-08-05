import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import Dotenv from 'dotenv'
Dotenv.config()

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
        zippedArchive: true,
        handleExceptions: true,
        json: isJson,
        createSymlink: true,
        symlinkName: `${filename}.log`,
        maxSize: '20m',
        maxFiles: '7d',
    })
}

export function getAppLogger(label: string = '', opt?: { isJson: boolean, consoleLevel: string }) {
    const isJson = opt?.isJson ?? true
    const consoleLevel = opt?.consoleLevel ?? 'debug'
    const format = logFormat(label, isJson)
    return createLogger({
        format,
        transports: [
            new transports.Console({
                level: consoleLevel,
                format: combine(colorize(), logFormat(label, false))
            }),
            newRotateFile('error', 'error'),
            newRotateFile('app')
        ],
        exceptionHandlers: [
            newRotateFile('exception', 'error', false)
            // new transports.File({ filename: 'logs/exceptions.log' })
        ],
        exitOnError: false
    })
}

export function accessLogger() {
    return createLogger({
        format: logFormat('access', false),
        transports: [
            new transports.Console({
                level: 'debug',
                format: combine(colorize(), logFormat('access', false))
            }),
            newRotateFile('access', 'http')
        ],
        exceptionHandlers: [
            newRotateFile('access-exception', 'error')
        ],
        exitOnError: false
    })
}