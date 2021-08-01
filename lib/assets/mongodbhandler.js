const mongoose = require('mongoose');
const Moment = require("moment");
import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import File from './models/nosql/File';

class FCMongoDBHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            system: null,
            url: null,
            tableName: null,
            properDelete: null,
        };

        this.mongoose = mongoose;
    }

    async connect(){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "MongoDBHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            this.FileModel = File({ t: validateConfig.object.tableName, });
            return await this.connectToDatabase();

            Config.debug ? console.log("New FCMongoDBHandler initialized") : false;
        }else{ Config.debug ? console.log("New FCMongoDBHandler initialization failed") : false; }
    }

    // Private function.
    // Connects to the database.
    async connectToDatabase(){
        try{
            await this.mongoose.connect(this.config.url, {
                useUnifiedTopology: true,
                useFindAndModify: false
            });

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

        let found = [];
        let toReturn = [];

        if(validateConfig.success){
            if(validateConfig.object.userId){
                if(validateConfig.object.folder){
                    if(validateConfig.object.folder.toString().trim() === "*"){
                        found = await this.FileModel.find({ isDeleted: false, userId: validateConfig.object.userId, });
                    }

                    found = await this.FileModel.find({ isDeleted: false, userId: validateConfig.object.userId, folder: validateConfig.object.folder, });
                }

                found = await this.FileModel.find({ isDeleted: false, userId: validateConfig.object.userId, });
            }else{
                if(validateConfig.object.folder){
                    if(validateConfig.object.folder.toString().trim() === "*"){
                        found = await this.FileModel.find({ isDeleted: false, });
                    }

                    found = await this.FileModel.find({ isDeleted: false, folder: validateConfig.object.folder, });
                }

                found = await this.FileModel.find({ isDeleted: false, });
            }
        }

        if(Array.isArray(found)){
            for(let each of found){
                if(each){
                    try{
                        toReturn.push(await each.renameId());
                    }catch(error){}
                }
            }
        }

        return toReturn;
    }

    // Private function.
    // Gets file entry from the database.
    async getModel(options){
        if(typeof options === "object" && options.path && typeof options.path === "string"){
            if(options.userId){
                return this.FileModel.findOne({ path: options.path, userId: options.userId, isDeleted: false, }).then(async data => { try{ return await data.renameId(); }catch(error){ return null; } }).catch(error => { return null; });
            }else{
                return this.FileModel.findOne({ path: options.path, isDeleted: false, }).then(async data => { try{ return await data.renameId(); }catch(error){ return null; } }).catch(error => { return null; });
            }
        }else{ return null; }
    }

    // Private function.
    // Creates file entry in the database.
    async newModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_NewModel", });

        if(validateConfig.success){
            try{
                let path = `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`;
                await this.FileModel.create({ userId: validateConfig.object.userId, name: validateConfig.object.name, extension: validateConfig.object.ext, folder: validateConfig.object.folder, size: validateConfig.object.size, isEncrypted: validateConfig.object.isEncrypted, path: path, });
                return await this.getModel({ path });
            }catch(error){
                console.log(error);
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
                let utcStamp = Moment.utc().valueOf();
                let updates = { isDeleted: true, deleted_at: utcStamp, };

                if(this.config.properDelete === false){
                    if(validateConfig.object.id){
                        if(validateConfig.object.userId){
                            return await this.FileModel.findOneAndUpdate({
                                _id: validateConfig.object.id,
                                isDeleted: false,
                                userId: validateConfig.object.userId,
                            }, updates).then(message => { return true; }).catch(error => { return false; });
                        }else{
                            return await this.FileModel.findOneAndUpdate({
                                _id: validateConfig.object.id,
                                isDeleted: false,
                            }, updates).then(message => { return true; }).catch(error => { return false; });
                        }
                    }else{
                        if(validateConfig.object.path){
                            if(validateConfig.object.userId){
                                return await this.FileModel.findOneAndUpdate({
                                    path: validateConfig.object.path,
                                    isDeleted: false,
                                    userId: validateConfig.object.userId,
                                }, updates).then(message => { return true; }).catch(error => { return false; });
                            }else{
                                return await this.FileModel.findOneAndUpdate({
                                    path: validateConfig.object.path,
                                    isDeleted: false,
                                }, updates).then(message => { return true; }).catch(error => { return false; });
                            }
                        }else{ return false; }
                    }
                }else{
                    if(validateConfig.object.id){
                        if(validateConfig.object.userId){
                            return await this.FileModel.findOneAndDelete({ _id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }).then(message => { return true; }).catch(error => { return false; });
                        }else{
                            return await this.FileModel.findOneAndDelete({ _id: validateConfig.object.id, isDeleted: false, }).then(message => { return true; }).catch(error => { return false; });
                        }
                    }else{
                        if(validateConfig.object.path){
                            if(validateConfig.object.userId){
                                return await this.FileModel.findOneAndDelete({ path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }).then(message => { return true; }).catch(error => { return false; });
                            }else{
                                return await this.FileModel.findOneAndDelete({ path: validateConfig.object.path, isDeleted: false, }).then(message => { return true; }).catch(error => { return false; });
                            }
                        }else{ return false; }
                    }
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
                const model = await this.FileModel.findOne(
                    validateConfig.object.id && validateConfig.object.userId ? { _id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }
                    : validateConfig.object.id ? { _id: validateConfig.object.id, isDeleted: false, }
                    : validateConfig.object.path && validateConfig.object.userId ? { path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }
                    : validateConfig.object.path ? { path: validateConfig.object.path, isDeleted: false, }
                    : { _id: null, }
                );

                if(!model){ return false; }

                let updates = { };
                if(validateConfig.object.newName){
                    const newFilePath = `${model.folder}${model.folder === "" ? "" : "/"}${validateConfig.object.newName}.${model.extension}`;
                    updates = { name: validateConfig.object.newName, path: newFilePath };
                }else{
                    if(validateConfig.object.isEncrypted !== undefined && validateConfig.object.isEncrypted !== null){
                        updates = { isEncrypted: validateConfig.object.isEncrypted };
                    }
                }

                if(validateConfig.object.id){
                    if(validateConfig.object.userId){
                        return await this.FileModel.findOneAndUpdate({ _id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }, updates).then(message => { return true; }).catch(error => { return false; });
                    }else{
                        return await this.FileModel.findOneAndUpdate({ _id: validateConfig.object.id, isDeleted: false, }, updates).then(message => { return true; }).catch(error => { return false; });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.userId){
                            return await this.FileModel.findOneAndUpdate({ path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }, updates).then(message => { return true; }).catch(error => { return false; });
                        }else{
                            return await this.FileModel.findOneAndUpdate({ path: validateConfig.object.path, isDeleted: false, }, updates).then(message => { return true; }).catch(error => { return false; });
                        }
                    }else{ return false; }
                }

                return true;
            }catch(error){
                return false;
            }
        }else{ return false; }
    }
}

module.exports = FCMongoDBHandler;
