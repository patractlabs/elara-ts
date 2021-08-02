import { Optional } from 'sequelize'
import { Model, DataType, Table, Column, ForeignKey, BelongsTo, PrimaryKey, AutoIncrement} from 'sequelize-typescript'
import Chain from './chain'

export interface ChainConfigAttr {
    id: number,
    serverId: number,       // default 0, elara sever id bind
    baseUrl: string,        // host:port
    rpcPort: number,       // default 9933
    wsPort: number,        // default 9944
    kvEnable: boolean,      // default false
    kvBaseUrl?: string,
    kvPort?: number,
    chainId?: number
}

interface ChainConfigCreateOptionAttr extends Optional<ChainConfigAttr, 'id'> {}

@Table({
    paranoid: true
})
export default class ChainConfig extends 
Model<ChainConfigAttr, ChainConfigCreateOptionAttr> {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    id!: number
    
    @Column(DataType.INTEGER)
    serverId!: number
    
    @Column(DataType.STRING)
    baseUrl!: string

    @Column(DataType.INTEGER)
    rpcPort!: number

    @Column(DataType.INTEGER)
    wsPort!: number

    @Column(DataType.BOOLEAN)
    kvEnable!: boolean

    @Column(DataType.STRING)
    kvBaseUrl?: string

    @Column(DataType.INTEGER)
    kvPort?: number

    @ForeignKey(() => Chain)
    @Column
    chainId?: number

    @BelongsTo(() => Chain)
    chain?: Chain
}