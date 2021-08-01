import {
    Model, DataTypes, Sequelize, Optional, Association,
    HasManyGetAssociationsMixin,
    HasManyAddAssociationMixin,
    HasManyHasAssociationMixin,
    HasManyCountAssociationsMixin,
    HasManyCreateAssociationMixin

} from 'sequelize'
import Project, { getModel as getProjectModel } from './project'
import Limit from './limit'
// import { Pg } from '../dao/pg'

// const LModel = getLimitModel(Pg)

export enum UserStat {
    Active = 'active',
    Suspend = 'suspend',    // update 00:00 o'clock
    Barred = 'barred'       // account abandon
}

export enum UserLevel {
    Normal = 'normal',
    Bronze = 'bronzer',
    Silver = 'silver',
    Gold = 'gold'
}

export enum LoginType {
    Github = 'github',
    Phone = 'phone',
    Mail = 'mail'
}

export interface UserAttr {
    id: number,
    name: string,
    status: UserStat,
    level: UserLevel,
    loginType: LoginType,
    githubId?: string,
    phone?: string,
    mail?: string,
}

interface UserCreateOptionAttr extends Optional<UserAttr, 'id'> { }

class User extends Model<UserAttr, UserCreateOptionAttr>
    implements UserAttr {
    public id!: number
    public name!: string
    public status!: UserStat
    public level!: UserLevel
    public loginType!: LoginType
    public githubId?: string
    public phone?: string
    public mail?: string

    //
    public readonly createAt!: Date
    public readonly updateAt!: Date
    public readonly deleteAt?: Date

    // Since TS cannot determine model association at compile time  
    // we have to declare them here purely virtually  
    // these will not exist until `Model.init` was called.  
    public getProjects!: HasManyGetAssociationsMixin<Project>; // Note the null assertions!  
    public addProject!: HasManyAddAssociationMixin<Project, number>;
    public hasProject!: HasManyHasAssociationMixin<Project, number>;
    public countProjects!: HasManyCountAssociationsMixin;
    public createProject!: HasManyCreateAssociationMixin<Project>;

    public static associations: {
        project: Association<User, Project>
        limit: Association<User, Limit>
    }
}

export function getModel(sequelize: Sequelize) {
    User.init({
        id: {
            type: DataTypes.BIGINT,
            unique: true,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        githubId: {
            type: DataTypes.STRING,
            unique: true
        },
        name: DataTypes.STRING,
        status: DataTypes.STRING,
        loginType: DataTypes.STRING,
        level: DataTypes.STRING
    },
        {
            sequelize,
            paranoid: true, // 逻辑删除
            modelName: 'user',
        })
    User.sync()
    User.hasMany(getProjectModel(sequelize), {
        foreignKey: {
            name: 'userId'
        }
    })
    // User.hasOne(Limit, {
    //     sourceKey: 'level'
    // })
    return User
}

export default User