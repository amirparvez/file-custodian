const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require("../mysqlhandler");

class File extends Model{

}

function newFile(config){
    const sequelize = config.s;
    const tableName = config.t;

    return File.init({
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

        folder: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: "/",
        },

        path: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        extension: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        size: {
            type: DataTypes.BIGINT,
            allowNull: false,
            defaultValue: 0,
        },

        isEncrypted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },

        isDeleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },

        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, { sequelize, modelName: 'File', tableName, updatedAt: 'updated_at', createdAt: 'created_at', });
}

module.exports = newFile;
