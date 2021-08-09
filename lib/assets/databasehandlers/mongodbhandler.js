import Moment from 'moment';
import mongoose from 'mongoose';

import Logger from '../misc/logger.js';
import ObjectValidator from '../misc/objectvalidator.js';
import File from '../models/nosql/File.js';

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

            Logger.log("New FCMongoDBHandler initialized");
        }else{ Logger.log("New FCMongoDBHandler initialization failed"); }
    }

    // Private function.
    // Connects to the database.
    async connectToDatabase(){
        try{
            await this.mongoose.connect(this.config.url, {
                useUnifiedTopology: true,
                useNewUrlParser: true,
                useFindAndModify: false
            });

            Logger.log('Connection with database has been established successfully.');
            return true;
        }catch(error){ Logger.log('Unable to connect to the database:', error); }
        return false;
    }

    // Creates new table.
    async createTable(){
        try{
            Logger.log("Creating table");
            this.FileModel.collection.drop();
            Logger.log("Table created");
        }catch(error){
            Logger.log(error);
            return false;
        }

        return true;
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
                    }catch(error){ Logger.log(error); }
                }
            }
        }

        return toReturn;
    }

    // Private function.
    // Gets file entry from the database.
    async getModel(options){
        if(typeof options === "object" && options.path && typeof options.path === "string"){
            let model = null;
            if(options.userId){
                model = await this.FileModel.findOne({ path: options.path, userId: options.userId, isDeleted: false, });
            }else{
                model = await this.FileModel.findOne({ path: options.path, isDeleted: false, });
            }

            if(model){
                try{
                    return await model.renameId();
                }catch(error){ Logger.log(error); }
            }
        }

        return null;
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
            }catch(error){ Logger.log(error); }
        }

        return null;
    }

    // Private function.
    // Deletes/Updates file entry from/in the database.
    async deleteModel(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteModel", });

        if(validateConfig.success){
            try{
                let utcStamp = Moment.utc().valueOf();
                let updates = { isDeleted: true, deleted_at: utcStamp, };
                let config = { upsert: false };

                if(this.config.properDelete === false){
                    if(validateConfig.object.id){
                        if(validateConfig.object.userId){
                            return await this.FileModel.findOneAndUpdate({
                                _id: validateConfig.object.id,
                                isDeleted: false,
                                userId: validateConfig.object.userId,
                            }, updates, config).then(message => { return true; }).catch(error => { return false; });
                        }else{
                            return await this.FileModel.findOneAndUpdate({
                                _id: validateConfig.object.id,
                                isDeleted: false,
                            }, updates, config).then(message => { return true; }).catch(error => { return false; });
                        }
                    }else{
                        if(validateConfig.object.path){
                            if(validateConfig.object.userId){
                                return await this.FileModel.findOneAndUpdate({
                                    path: validateConfig.object.path,
                                    isDeleted: false,
                                    userId: validateConfig.object.userId,
                                }, updates, config).then(message => { return true; }).catch(error => { return false; });
                            }else{
                                return await this.FileModel.findOneAndUpdate({
                                    path: validateConfig.object.path,
                                    isDeleted: false,
                                }, updates, config).then(message => { return true; }).catch(error => { return false; });
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
            }catch(error){ Logger.log(error); }
        }

        return false;
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
                    }else{
                        if(validateConfig.object.size !== undefined && validateConfig.object.size !== null){
                            updates = { size: validateConfig.object.size };
                        }
                    }
                }

                let config = { upsert: false };
                if(validateConfig.object.id){
                    if(validateConfig.object.userId){
                        return await this.FileModel.findOneAndUpdate({ _id: validateConfig.object.id, isDeleted: false, userId: validateConfig.object.userId, }, updates, config).then(message => { return true; }).catch(error => { return false; });
                    }else{
                        return await this.FileModel.findOneAndUpdate({ _id: validateConfig.object.id, isDeleted: false, }, updates, config).then(message => { return true; }).catch(error => { return false; });
                    }
                }else{
                    if(validateConfig.object.path){
                        if(validateConfig.object.userId){
                            return await this.FileModel.findOneAndUpdate({ path: validateConfig.object.path, isDeleted: false, userId: validateConfig.object.userId, }, updates, config).then(message => { return true; }).catch(error => { return false; });
                        }else{
                            return await this.FileModel.findOneAndUpdate({ path: validateConfig.object.path, isDeleted: false, }, updates, config).then(message => { return true; }).catch(error => { return false; });
                        }
                    }else{ return false; }
                }

                return true;
            }catch(error){ Logger.log(error); }
        }

        return false;
    }
}

export default FCMongoDBHandler;
