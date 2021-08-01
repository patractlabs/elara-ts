import { Model, DataTypes, Sequelize, Optional } from 'sequelize'

export interface ChainAttr {
    id: number,
    name: string,
    team: string,
    network: string,

}

interface ChainCreateOptionAttr extends Optional<ChainAttr, 'id'> {}

class ChainModel extends Model<ChainAttr, ChainCreateOptionAttr>
implements ChainAttr {
    id!: number
    name!: string
    team!: string
    network!: string

}

export default class Chain {

    static getModel(sequelize: Sequelize) {
        ChainModel.init({
            id: {
                type: DataTypes.BIGINT,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING,
                unique: true
            },
            team: DataTypes.STRING,
            network: DataTypes.STRING
        }, {
            sequelize,
            paranoid: true,
            modelName: 'chain'
        })
        ChainModel.sync()
        return ChainModel
    }
}