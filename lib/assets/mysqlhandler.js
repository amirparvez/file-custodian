const { Sequelize, DataTypes, Model, Op } = require('sequelize');
const Moment = require("moment");
import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import File from './models/File';

class FCMySQLHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            system: null,
            host: null,
            port: null,
            database: null,
            userName: null,
            password: null,
            tableName: null,
            properDelete: null,
            sequelizeInstance: null,
            userModel: null,
        };

        this.sequelize_config = {s: null, t: null};
        this.sequelize = null;
    }

    async connect(){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "MySQLHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.sequelizeInstance !== null){
                this.sequelize = this.config.sequelizeInstance;
            }else{
                // Create new sequelize instance if not provided.
                this.sequelize = new Sequelize(this.config.database, this.config.userName, this.config.password, {
                    host: this.config.host,
                    port: this.config.port,
                    dialect: this.config.system,
                    timezone: "+00:00",
                    dialectOptions: {
                      connectTimeout: 90000,
                      useUTC: true,
                      timezone: "+00:00",
                    },
                });
            }

            this.FileModel = File({s: this.sequelize, t: validateConfig.object.tableName,});

            return await this.connectToDatabase().then(async msg => {
                await self.setupModel();
                return true;
            }).catch(error => {
                return false;
            });

            Config.debug ? console.log("New FCMySQLHandler initialized") : false;
        }else{ Config.debug ? console.log("New FCMySQLHandler initialization failed") : false; }
    }

    // Private function.
    // Syncs File Model and relates with User model if required.
    async setupModel(){
        try{
            if(this.config.userModel){
                await this.config.userModel.hasMany(this.FileModel, { as: "FCFiles", foreignKey: "userId", });
                await this.FileModel.belongsTo(this.config.userModel, { as: "FileOwner", foreignKey: "userId", });
            }

            await this.FileModel.sync({alter: true});
        }catch(error){
            return false;
        }

        return true;
    }

    // Creates new table.
    async createTable(){
        try{
            Config.debug ? console.log("Creating table") : false;
            await this.FileModel.sync({force: true});
            Config.debug ? console.log("Table created") : false;
        }catch(error){
            return false;
        }

        return true;
    }

    // Private function.
    // Connects to the database.
    async connectToDatabase(){
        try{
            await this.sequelize.authenticate();
            Config.debug ? console.log('Connection with database has been established successfully.') : false;

            return true;
        }catch(error){
            Config.debug ? console.log('Unable to connect to the database:', error) : false;
            return false;
        }
    }

    // Private function.
    // Gets files entry from the database.
    async getAllModels(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetAllModels", });

        if(validateConfig.success){
            if(validateConfig.object.userId){
                if(validateConfig.object.folder){
                    if(validateConfig.object.folder.toString().trim() === "*"){
                        return await this.FileModel.findAll({ where: { isDeleted: false, userId: validateConfig.object.userId, }, });
                    }

                    return await this.FileModel.findAll({ where: { isDeleted: false, userId: validateConfig.object.userId, folder: validateConfig.object.folder, }, });
                }

                return await this.FileModel.findAll({ where: { isDeleted: false, userId: validateConfig.object.userId, }, });
            }else{
                if(validateConfig.object.folder){
                    if(validateConfig.object.folder.toString().trim() === "*"){
                        return await this.FileModel.findAll({ where: { isDeleted: false, }, });
                    }

                    return await this.FileModel.findAll({ where: { isDeleted: false, folder: validateConfig.object.folder, }, });
                }

                return await this.FileModel.findAll({ where: { isDeleted: false, }, });
            }
        }

        return [];
    }

    // Private function.
    // Gets file entry from the database.
    async getModel(options){
        if(typeof options === "object" && options.path && typeof options.path === "string"){
            if(options.userId){
                return this.FileModel.findOne({ where: { path: options.path, userId: options.userId, isDeleted: false, }, include: {all: true,}, });
            }else{
                return this.FileModel.findOne({ where: { path: options.path, isDeleted: false, }, include: {all: true,}, });
            }
        }else{ return null; }
    }

    // Private function.
    // Creates file entry in the database.
    async newModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_NewModel", });

        if(validateConfig.success){
            try{
                let newM = await this.FileModel.create({ userId: validateConfig.object.userId, name: validateConfig.object.name, extension: validateConfig.object.ext, folder: validateConfig.object.folder, size: validateConfig.object.size, isEncrypted: validateConfig.object.isEncrypted, path: `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, });
                return newM;
            }catch(error){
                return null;
            }
        }else{ return null; }
    }

    // Private function.
    // Deletes/Updates file entry from/in the database.
    async deleteModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteModel", });

        if(validateConfig.success){
            try{
                let model = null;
                if(validateConfig.object.id){
                    if(validateConfig.object.userId){
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }, });
                    }else{
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, }, });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.userId){
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }, });
                        }else{
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, }, });
                        }
                    }else{ return false; }
                }

                if(!model){return false;}

                this.config.properDelete === true ? model.destroy() : false;

                if(this.config.properDelete === false){
                    let utcStamp = Moment.utc().valueOf();
                    await model.update({ isDeleted: true, deleted_at: utcStamp, });
                }

                return true;
            }catch(error){
                return false;
            }
        }else{ return false; }
    }

    // Private function.
    // Updates file entry in the database.
    async updateModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_UpdateModel", });

        if(validateConfig.success){
            try{
                let model = null;
                if(validateConfig.object.id){
                    if(validateConfig.object.userId){
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }, });
                    }else{
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, }, });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.userId){
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }, });
                        }else{
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, }, });
                        }
                    }else{ return false; }
                }

                if(model == null){return false;}

                if(validateConfig.object.newName){
                    const newFilePath = `${model.folder}${model.folder === "" ? "" : "/"}${validateConfig.object.newName}.${model.extension}`;
                    await model.update({ name: validateConfig.object.newName, path: newFilePath, });
                }else{
                    if(validateConfig.object.isEncrypted !== undefined && validateConfig.object.isEncrypted !== null){
                        await model.update({ isEncrypted: validateConfig.object.isEncrypted, });
                    }
                }

                return true;
            }catch(error){
                return false;
            }
        }else{ return false; }
    }
}

module.exports = FCMySQLHandler;
