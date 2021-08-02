import { Sequelize } from "sequelize-typescript"
import { getAppLogger } from "@elara/lib"
import Conf from '../config'

const log = getAppLogger('sequelize')
const dconf = Conf.getDB()

const sequelize =  new Sequelize(dconf.table, dconf.user, dconf.password, {
    host: dconf.host,
    port: dconf.port,
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

export default sequelize