import { Model, DataTypes, Sequelize, Optional } from 'sequelize'
import { UserLevel } from './user'

export interface LimitAttr {
    id: number,
    level: UserLevel,
    projectNum: number,
    bwDayLimit: number,
    reqDayLimit: number,
    reqSecLimit: number
}

interface LimitCreateOptionAttr extends Optional<LimitAttr, 'id'> {}

class Limit extends Model<LimitAttr, LimitCreateOptionAttr>
implements LimitAttr {
    id!: number
    level!: UserLevel
    projectNum!: number
    bwDayLimit!: number
    reqDayLimit!: number
    reqSecLimit!: number
}

export function getModel(sequelize: Sequelize) {
    Limit.init({
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        level: DataTypes.STRING,
        projectNum: DataTypes.INTEGER,
        reqDayLimit: DataTypes.INTEGER,
        reqSecLimit: DataTypes.INTEGER,
        bwDayLimit: DataTypes.INTEGER
    }, {
        sequelize,
        paranoid: true,
        modelName: 'limit'
    })
    Limit.sync()
    return Limit
}

export default Limit