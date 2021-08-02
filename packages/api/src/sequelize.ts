import { Sequelize } from "sequelize-typescript"
import { getAppLogger } from "@elara/lib"
// import Chain from '../model/chain'
// import ChainConfig from '../models/chain-config'

const log = getAppLogger('sequelize')

const seq =  new Sequelize('elara', 'root', 'root', {
    host: '127.0.0.1',
    port: 5432,
    dialect: 'postgres',
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    models: [__dirname + '/models/*.ts'],
    logging: process.env.NODE_ENV === 'dev' ? msg => log.debug(msg) : false
})

log.debug('dir: ', __dirname)
export default seq