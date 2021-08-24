import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, PrimaryKey, AutoIncrement, Unique, HasMany } from 'sequelize-typescript'
import User, { UserLevel } from './user'

export interface LimitAttr {
    id: number,
    level: UserLevel,
    projectNum: number,
    bwDayLimit: number,
    reqDayLimit: number,
    reqSecLimit: number
}

interface LimitCreateOptionAttr extends Optional<LimitAttr, 'id'> { }

@Table({
    tableName: 'limits'
})
export default class Limit extends Model<LimitAttr, LimitCreateOptionAttr>
    implements LimitAttr {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    id!: number

    @Column(DataType.INTEGER)
    projectNum!: number

    @Column(DataType.BIGINT)
    bwDayLimit!: number

    @Column(DataType.BIGINT)
    reqDayLimit!: number

    @Column(DataType.BIGINT)
    reqSecLimit!: number

    @Unique
    @Column(DataType.STRING)
    level!: UserLevel

    @HasMany(() => User)
    users!: User[]
}