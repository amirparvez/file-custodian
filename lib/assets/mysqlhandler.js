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

    async init(){
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "MySQLHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.sequelize_instance !== null){
                this.sequelize = this.config.sequelize_instance;
            }else{
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

    async setupModel(){
        if(this.config.user_model !== null){
            await this.config.user_model.hasMany(this.FileModel, { as: "FCFiles", foreignKey: "user_id", });
            await this.FileModel.belongsTo(this.config.user_model, { as: "FileOwner", foreignKey: "user_id", });
        }

        /*console.log(await this.config.user_model.findOne({
            where: {
                id: 1
            },
            include: { all: true },
        }));*/

        await this.FileModel.sync({alter: true});
    }

    async createTable(){
        console.log("creating table");
        await this.FileModel.sync({force: true});
        console.log("table created");
    }

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

    async getModel(options){
        if(typeof options === "object" && options.path && typeof options.path === "string"){
            return this.FileModel.findOne({
                where: {
                    path: options.path,
                },
                include: {all: true,},
            });
        }else{ return null; }
    }

    async newModel(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_NewModel", });

        if(validateConfig.success){
            try{
                var newM = await this.FileModel.create({
                    user_id: validateConfig.object.user_id,
                    name: validateConfig.object.name,
                    extension: validateConfig.object.ext,
                    folder: validateConfig.object.folder,
                    size: validateConfig.object.size,
                    isEncrypted: validateConfig.object.isEncrypted,
                    path: `${validateConfig.object.folder}${validateConfig.object.folder == "/" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`,
                });

                return newM;
            }catch(error){
                return null;
            }
        }else{ return null; }
    }

    async deleteModel(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteModel", });

        if(validateConfig.success){
            try{
                var model = null;
                if(validateConfig.object.id){
                    model = await this.FileModel.findOne({
                        where: {
                            id: validateConfig.object.id,
                            isDeleted: false,
                        },
                    });
                }else{
                    if(validateConfig.object.path){
                        model = await this.FileModel.findOne({
                            where: {
                                path: validateConfig.object.path,
                                isDeleted: false,
                            },
                        });
                    }else{ return false; }
                }

                if(model == null){return false;}

                this.config.proper_delete === true ? model.destroy() : false;

                if(this.config.proper_delete === false){
                    var utcStamp = Moment.utc().valueOf();
                    await model.update({ isDeleted: true, deleted_at: utcStamp, });
                }

                return true;
            }catch(error){
                return false;
            }
        }else{ return false; }
    }

    async updateModel(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_UpdateModel", });

        if(validateConfig.success){
            try{
                var model = null;
                if(validateConfig.object.id){
                    model = await this.FileModel.findOne({
                        where: {
                            id: validateConfig.object.id,
                            isDeleted: false,
                        },
                    });
                }else{
                    if(validateConfig.object.path){
                        model = await this.FileModel.findOne({
                            where: {
                                path: validateConfig.object.path,
                                isDeleted: false,
                            },
                        });
                    }else{ return false; }
                }

                if(model == null){return false;}

                if(validateConfig.object.new_name !== null){
                    var newFilePath = `${model.folder}${model.folder == "/" ? "" : "/"}${validateConfig.object.new_name}.${model.extension}`;
                    await model.update({ name: validateConfig.object.new_name, path: newFilePath, });
                }else{
                    if(validateConfig.object.isEncrypted !== null){
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
