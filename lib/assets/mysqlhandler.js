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
            username: null,
            password: null,
            table_name: null,
            proper_delete: null,
            sequelize_instance: null,
            user_model: null,
        };

        this.sequelize_config = {s: null, t: null};
        this.sequelize = null;
    }

    async connect(){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "MySQLHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.sequelize_instance !== null){
                this.sequelize = this.config.sequelize_instance;
            }else{
                // Create new sequelize instance if not provided.
                this.sequelize = new Sequelize(this.config.database, this.config.username, this.config.password, {
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

            this.FileModel = File({s: this.sequelize, t: validateConfig.object.table_name,});

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
            if(this.config.user_model){
                await this.config.user_model.hasMany(this.FileModel, { as: "FCFiles", foreignKey: "user_id", });
                await this.FileModel.belongsTo(this.config.user_model, { as: "FileOwner", foreignKey: "user_id", });
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
            console.log("creating table");
            await this.FileModel.sync({force: true});
            console.log("table created");
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

    async getAllModels(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetAllModels", });

        if(validateConfig.success){
            if(validateConfig.object.user_id){
                if(validateConfig.object.folder){
                    if(validateConfig.object.folder.toString().trim() === "*"){
                        return await this.FileModel.findAll({ where: { isDeleted: false, user_id: validateConfig.object.user_id, }, });
                    }

                    return await this.FileModel.findAll({ where: { isDeleted: false, user_id: validateConfig.object.user_id, folder: validateConfig.object.folder, }, });
                }

                return await this.FileModel.findAll({ where: { isDeleted: false, user_id: validateConfig.object.user_id, }, });
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

    // Gets file entry from the database.
    async getModel(options){
        if(typeof options === "object" && options.path && typeof options.path === "string"){
            if(options.user_id){
                return this.FileModel.findOne({ where: { path: options.path, user_id: options.user_id, isDeleted: false, }, include: {all: true,}, });
            }else{
                return this.FileModel.findOne({ where: { path: options.path, isDeleted: false, }, include: {all: true,}, });
            }
        }else{ return null; }
    }

    // Creates file entry in the database.
    async newModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_NewModel", });

        if(validateConfig.success){
            try{
                let newM = await this.FileModel.create({ user_id: validateConfig.object.user_id, name: validateConfig.object.name, extension: validateConfig.object.ext, folder: validateConfig.object.folder, size: validateConfig.object.size, isEncrypted: validateConfig.object.isEncrypted, path: `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, });
                return newM;
            }catch(error){
                return null;
            }
        }else{ return null; }
    }

    // Deletes/Updates file entry from/in the database.
    async deleteModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteModel", });

        if(validateConfig.success){
            try{
                let model = null;
                if(validateConfig.object.id){
                    if(validateConfig.object.user_id){
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, user_id: validateConfig.object.user_id, }, });
                    }else{
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, }, });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.user_id){
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, user_id: validateConfig.object.user_id, }, });
                        }else{
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, }, });
                        }
                    }else{ return false; }
                }

                if(!model){return false;}

                this.config.proper_delete === true ? model.destroy() : false;

                if(this.config.proper_delete === false){
                    let utcStamp = Moment.utc().valueOf();
                    await model.update({ isDeleted: true, deleted_at: utcStamp, });
                }

                return true;
            }catch(error){
                return false;
            }
        }else{ return false; }
    }

    // Updates file entry in the database.
    async updateModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_UpdateModel", });

        if(validateConfig.success){
            try{
                let model = null;
                if(validateConfig.object.id){
                    if(validateConfig.object.user_id){
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, user_id: validateConfig.object.user_id, }, });
                    }else{
                        model = await this.FileModel.findOne({ where: { id: validateConfig.object.id, isDeleted: false, }, });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.user_id){
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, user_id: validateConfig.object.user_id, }, });
                        }else{
                            model = await this.FileModel.findOne({ where: { path: validateConfig.object.path, isDeleted: false, }, });
                        }
                    }else{ return false; }
                }

                if(model == null){return false;}

                if(validateConfig.object.new_name){
                    const newFilePath = `${model.folder}${model.folder === "" ? "" : "/"}${validateConfig.object.new_name}.${model.extension}`;
                    await model.update({ name: validateConfig.object.new_name, path: newFilePath, });
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
