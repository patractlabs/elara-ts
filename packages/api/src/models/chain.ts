import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, HasMany, PrimaryKey, AutoIncrement } from 'sequelize-typescript'
import ChainConfig from './chain-config'

export interface ChainAttr {
    id: number,
    name: string,
    team: string,
    network: string,
}

interface ChainCreateOptionAttr extends Optional<ChainAttr, 'id'> {}

@Table({
    paranoid: true
})
export default class Chain extends Model<ChainAttr, ChainCreateOptionAttr> {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    id!: number

    @Column(DataType.STRING)
    name!: string

    @Column(DataType.STRING)
    team!: string

    @Column(DataType.STRING)
    network!: string

    @HasMany(() => ChainConfig)
    configs?: ChainConfig[]
}