import { Sequelize } from "sequelize"
import { getAppLogger } from "@elara/lib"

const log = getAppLogger('pg')

export const Pg = new Sequelize('elara', 'root', 'root', {
    host: '127.0.0.1',
    port: 5432,
    dialect: 'postgres',
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    logging: process.env.NODE_ENV === 'dev' ? msg => log.debug(msg) : false
})

async function run () {
    try {
        await Pg.authenticate()
        log.info('postgres connection open')
    } catch(err) {
        log.error('Unable to connect to the database: ', err)
        process.exit(1)
    }
}

run()