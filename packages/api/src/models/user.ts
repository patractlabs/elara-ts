import { Optional } from "sequelize";
import {
    Model,
    DataType,
    Table,
    Column,
    PrimaryKey,
    AutoIncrement,
    HasMany,
    Unique,
    BelongsTo,
    ForeignKey
} from "sequelize-typescript";
import Limit from "./limit";

import Project from "./project";

export enum UserStat {
    Active = "active",
    Suspend = "suspend", // update 00:00 o'clock
    Barred = "barred", // account abandon
}

export enum UserLevel {
    Normal = "normal",
    Bronze = "bronzer",
    Silver = "silver",
    Golden = "gold",
}

export enum LoginType {
    Github = "github",
    Phone = "phone",
    Mail = "mail",
}

export interface UserAttr {
    id: number;
    name: string;
    status: UserStat;
    levelId: number;
    level: UserLevel;
    loginType: LoginType;
    githubId?: string;
    phone?: string;
    mail?: string;
}

interface UserCreateOptionAttr extends Optional<UserAttr, "id"> {}

@Table
export default class User extends Model<UserAttr, UserCreateOptionAttr> {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.BIGINT)
    id!: number;

    @Column(DataType.STRING)
    name!: string;

    @Column(DataType.STRING)
    status!: UserStat;

    @Column(DataType.STRING)
    level!: UserLevel;

    @Column(DataType.STRING)
    loginType!: LoginType;

    @Unique
    @Column(DataType.STRING)
    githubId?: string;

    @Column(DataType.STRING)
    phone?: string;

    @Column(DataType.STRING)
    mail?: string;

    @HasMany(() => Project)
    projects?: Project[];

    @BelongsTo(() => Limit)
    limit!: Limit

    @ForeignKey(() => Limit)
    @Column(DataType.BIGINT)
    levelId!: number
}
