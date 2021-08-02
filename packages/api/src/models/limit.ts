import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, PrimaryKey, AutoIncrement, Unique } from 'sequelize-typescript'
import { UserLevel } from './user'

export interface LimitAttr {
    id: number,
    level: UserLevel,
    projectNum: number,
    bwDayLimit: number,
    reqDayLimit: number,
    reqSecLimit: number
}

interface LimitCreateOptionAttr extends Optional<LimitAttr, 'id'> { }

@Table
export default class Limit extends Model<LimitAttr, LimitCreateOptionAttr>
    implements LimitAttr {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    id!: number

    @Column(DataType.INTEGER)
    projectNum!: number

    @Column(DataType.INTEGER)
    bwDayLimit!: number

    @Column(DataType.INTEGER)
    reqDayLimit!: number

    @Column(DataType.INTEGER)
    reqSecLimit!: number

    @Unique
    @Column(DataType.STRING)
    level!: UserLevel
}