// This model is only for exampling.

import { DataTypes, Model, Op } from 'sequelize';

class User extends Model{

}

function newUser(config){
    const sequelize = config.s;

    return User.init({
        id: {
            type: DataTypes.BIGINT(11),
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },

        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, { sequelize, modelName: 'User', tableName: "users", updatedAt: 'updated_at', createdAt: 'created_at', });
}

export default newUser;
