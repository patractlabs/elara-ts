import { Model, DataTypes, Sequelize, Optional } from 'sequelize'
import User from './user'

export enum ProStatus {
    Active = 'Active',
    Stop = 'Stop',
    Suspend = 'Suspend',
    Delete = 'Delete'
}

export interface ProAttr {
    id: number,
    pid: string,
    name: string,
    status: ProStatus,
    chain: string,       // chain name, alias network
    team: string,
    // userId: string            // user id
    secret: string
    reqSecLimit: number,
    reqDayLimit: number,
    bwDayLimit: number
}

interface ProCreateOptionAttr extends Optional<ProAttr, 'id'> { }

class Project extends Model<ProAttr, ProCreateOptionAttr>
    implements ProAttr {
    public id!: number
    public pid!: string
    public name!: string
    public status!: ProStatus
    public chain!: string
    public team!: string
    // userId!: string
    public secret!: string
    public reqSecLimit!: number
    public reqDayLimit!: number
    public bwDayLimit!: number

    public readonly createAt!: Date
    public readonly updateAt!: Date
    public readonly deleteAt!: Date
}

export function getModel(sequelize: Sequelize) {
    Project.init({
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            unique: true,
            autoIncrement: true
        },
        pid: {
            type: DataTypes.STRING(32)
        },
        name: DataTypes.STRING(32),
        status: DataTypes.STRING(12),
        chain: DataTypes.STRING,
        team: DataTypes.STRING,
        secret: DataTypes.STRING(32),
        reqSecLimit: DataTypes.INTEGER,
        reqDayLimit: DataTypes.INTEGER,
        bwDayLimit: DataTypes.INTEGER
    },
        {
            sequelize,
            paranoid: true,
            modelName: 'project'
        })
    Project.sync()
    Project.belongsTo(User)
    return Project
}

// association

export default Project