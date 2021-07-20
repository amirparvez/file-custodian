import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';

class FCFile{
    constructor(config){
        this.config_provided = config;
        this.config = {
            id: null,
            name: null,
            ext: null,
            size: null,
            data: null,
            folder: null,
            path: null,
            isEncrypted: null,
            isDeleted: null,
            created_at: null,
            updated_at: null,
            deleted_at: null,
            handler: null,
        };
    }

    async beautifyPath(path){
        var finalPath = "";

        finalPath = path.replace(/\\/g, "/"); // back slashes to forward slashes
        finalPath = finalPath.replace(/\/\//g, '/'); // doubel slashes to single slash
        if(finalPath.indexOf('/') == 0){}else{
            // append forward slash in front
            finalPath = "/"+finalPath;
        }

        console.log("finalPath", finalPath);
        return finalPath;
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "File", });

        if(validateConfig.success){
            var data = validateConfig.object;
            var beautifiedPath = await this.beautifyPath(data.folder);
            var filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${data.name}.${data.ext}`;

            var size = await data.handler.getFileSize(`${data.handler.config.base_path}${filePath}`);
            this.config = {...data, folder: beautifiedPath, size };

            if(this.config.handler.database_handler){
                try{
                    var model = await this.config.handler.database_handler.getModel({ path: filePath, });
                    if(model){
                        var modelUniqueData = {
                            id: model.id,
                            path: model.path,
                            isEncrypted: model.isEncrypted,
                            isDeleted: model.isDeleted,
                            created_at: model.created_at,
                            deleted_at: model.deleted_at,
                            updated_at: model.updated_at,
                        };

                        var finalData = this.config.data;
                        var newData = finalData;

                        if(this.config.handler.file_protector !== null && modelUniqueData.isEncrypted == true){
                            newData = await this.config.handler.file_protector.read(finalData);
                        }

                        this.config.data = newData;
                        this.config = {...this.config, ...modelUniqueData};
                    }else{
                        await this.createModel();
                    }
                }catch(error){}
            }

            Config.debug ? console.log("New FCFile initialized") : false;
        }else{ Config.debug ? console.log("New FCFile initialization failed") : false; }
    }

    async delete(){
        var beautifiedPath = await this.beautifyPath(this.config.folder);
        var filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        var deleted = await this.config.handler.deleteFile({ path: filePath });
        if(deleted){
            if(this.config.handler.database_handler){
                var exists = await this.config.handler.database_handler.getModel({ path: filePath, });
                if(exists !== null && exists !== undefined){
                    var modelDeleted = await this.config.handler.database_handler.deleteModel({ path: filePath, });
                    return modelDeleted;
                }
            }else{ return true; }
        }else{ return false; }
    }

    async rename(new_name){
        var beautifiedPath = await this.beautifyPath(this.config.folder);
        var filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        var renamed = await this.config.handler.renameFile({ name: this.config.name, ext: this.config.ext, folder: this.config.folder, new_name });
        if(renamed){
            if(this.config.handler.database_handler){
                var exists = await this.config.handler.database_handler.getModel({ path: filePath, });
                if(exists !== null && exists !== undefined){
                    var modelRenamed = await this.config.handler.database_handler.updateModel({ path: filePath, new_name });
                    return modelRenamed;
                }
            }else{ return true; }
        }else{ return false; }
    }

    async protect(){
        // protect file if it isn't
    }

    async createModel(){
        var beautifiedPath = await this.beautifyPath(this.config.folder);
        var filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        if(this.config.handler.database_handler){
            var alreadyExists = await this.config.handler.database_handler.getModel({ path: filePath, });
            if(alreadyExists !== null && alreadyExists !== undefined){
                var modelUniqueData = {
                    id: alreadyExists.id,
                    path: alreadyExists.path,
                    isEncrypted: alreadyExists.isEncrypted,
                    isDeleted: alreadyExists.isDeleted,
                    created_at: alreadyExists.created_at,
                    deleted_at: alreadyExists.deleted_at,
                    updated_at: alreadyExists.updated_at,
                };

                this.config = {...this.config, ...modelUniqueData};
                return this;
            }else{
                var didEncrypt = false;
                var finalData = this.config.data;
                var newData = finalData;

                if(this.config.handler.file_protector !== null && this.config.isEncrypted == false){
                    newData = await this.config.handler.file_protector.protect(finalData);
                    if((newData.toString() === finalData.toString()) || newData == null){ didEncrypt = false; }else{ didEncrypt = true; }
                }

                this.config.data = newData;
                this.config.isEncrypted = didEncrypt;
                var newModel = await this.config.handler.database_handler.newModel({...this.config, path: filePath, });

                var modelUniqueData = {
                    id: newModel.id,
                    path: newModel.path,
                    isEncrypted: newModel.isEncrypted,
                    isDeleted: newModel.isDeleted,
                    created_at: newModel.created_at,
                    deleted_at: newModel.deleted_at,
                    updated_at: newModel.updated_at,
                };

                this.config = {...this.config, ...modelUniqueData};
                return this;
            }
        }else{ return null; }
    }
}

module.exports = FCFile;
