import { Sequelize, DataTypes, Model, Op } from 'sequelize';
import Moment from 'moment';
import Logger from '../logger.js';
import ObjectValidator from '../objectvalidator.js';
import File from '../models/sql/File.js';

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

            Logger.log("New FCMySQLHandler initialized");
        }else{ Logger.log("New FCMySQLHandler initialization failed"); }
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
            Logger.log("Creating table");

            this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', null, { raw: true });
            await this.FileModel.sync({force: true});
            this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', null, { raw: true });

            Logger.log("Table created");
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
            Logger.log('Connection with database has been established successfully.');
            return true;
        }catch(error){ Logger.log('Unable to connect to the database:', error); return false; }
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

export default FCMySQLHandler;
