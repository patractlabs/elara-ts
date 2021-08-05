import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo } from 'sequelize-typescript'
import { Network } from './chain'
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
    userId: number            // user id
    secret: string
    chain: string,
    team: string,
    network: Network,
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
    public secret!: string

    @Column(DataType.STRING)
    chain!: string

    @Column(DataType.STRING)
    team!: string

    @Column(DataType.STRING)
    network!: Network
    
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