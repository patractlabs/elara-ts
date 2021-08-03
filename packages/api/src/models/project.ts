import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo } from 'sequelize-typescript'

import User from './user'

export enum ProStatus {
    Active = 'active',
    Stop = 'stop',
    Suspend = 'suspend'
}

export interface ProAttr {
    id: number,
    pid: string,
    name: string,
    status: ProStatus,
    chain: string,           // chain name
    team: string,
    userId: number            // user id
    secret: string
    reqSecLimit: number,
    reqDayLimit: number,
    bwDayLimit: number
}

interface ProCreateOptionAttr extends Optional<ProAttr, 'id'> { }

@Table({
    paranoid: true
})
export default class Project extends Model<ProAttr, ProCreateOptionAttr> {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    public id!: number

    @Column(DataType.STRING)
    public pid!: string

    @Column(DataType.STRING)
    public name!: string

    @Column(DataType.STRING)
    public status!: ProStatus

    @Column(DataType.STRING)
    public chain!: string

    @Column(DataType.STRING)
    public team!: string

    @Column(DataType.STRING)
    public secret!: string

    @Column(DataType.INTEGER)
    public reqSecLimit!: number

    @Column(DataType.INTEGER)
    public reqDayLimit!: number

    @Column(DataType.INTEGER)
    public bwDayLimit!: number

    @ForeignKey(() => User)
    @Column(DataType.BIGINT)
    userId!: number

    @BelongsTo(() => User)
    user!: User
}