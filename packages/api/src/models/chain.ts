import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, HasMany, PrimaryKey, AutoIncrement,Unique } from 'sequelize-typescript'
import ChainConfig from './chain-config'

export enum Network {
    Live = 'live',
    Test = 'test',
    Polkadot = 'polkadot',
    Kusama = 'kusama',
    Westend = 'westend',
    Rococo = 'rococo'
}

export interface ChainAttr {
    id: number,
    name: string,
    team: string,
    network: Network,
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

    @Unique
    @Column(DataType.STRING)
    name!: string

    @Column(DataType.STRING)
    team!: string

    @Column(DataType.ENUM('live','test','polkadot','kusama','westend','rococo'))
    network!: Network

    @HasMany(() => ChainConfig)
    configs?: ChainConfig[]
}