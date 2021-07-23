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
            user_id: null,
            handler: null,
        };
    }

    // Private function.
    // Fixes any errors in a folder path.
    // Folder path must always start with a '/' but must never end with a '/'.
    async beautifyPath(path){
        let finalPath = "";

        finalPath = path.replace(/\\/g, "/"); // Convert back slashes to forward slashes.
        finalPath = finalPath.replace(/\/\//g, '/'); // Convert each double slashes to a single slash
        if(finalPath.charAt(0) == '/'){}else{
            // Add a forward slash in front
            finalPath = "/"+finalPath;
        }

        if(finalPath.charAt((finalPath.length - 1)) == '/'){
            // Remove the last forward slash
            finalPath = finalPath.substring(0, finalPath.length - 1);
        }else{}

        return finalPath;
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "File", });

        if(validateConfig.success){
            const data = validateConfig.object;
            const beautifiedPath = await this.beautifyPath(data.folder);
            const filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${data.name}.${data.ext}`;

            const size = await data.handler.getFileSize(`${data.handler.config.base_path}${filePath}`);
            this.config = {...data, folder: beautifiedPath, size };

            if(this.config.handler.database_handler){
                try{
                    const model = await this.config.handler.database_handler.getModel({ path: filePath, });
                    if(model){
                        // If file entry exists in database, sync it's values.
                        let modelUniqueData = {
                            id: model.id,
                            path: model.path,
                            isEncrypted: model.isEncrypted,
                            isDeleted: model.isDeleted,
                            created_at: model.created_at,
                            deleted_at: model.deleted_at,
                            updated_at: model.updated_at,
                            user_id: model.user_id,
                        };

                        /*let finalData = this.config.data;
                        let newData = finalData;

                        if(this.config.handler.file_protector !== null && modelUniqueData.isEncrypted == true){
                            // If file entry approves the data to be encrypted, decrypt it.
                            newData = await this.config.handler.file_protector.read(finalData);
                        }

                        this.config.data = newData; // Change the data to the decrypted data.*/
                        this.config = {...this.config, ...modelUniqueData};
                    }else{
                        await this.createModel();
                    }
                }catch(error){}
            }

            Config.debug ? console.log("New FCFile initialized") : false;
        }else{ Config.debug ? console.log("New FCFile initialization failed") : false; }
    }

    // Delete this file from it's depository and update the database as per the configuration provided to the custodian.
    async delete(){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        const deleted = await this.config.handler.deleteFile({ path: filePath });
        if(deleted){
            if(this.config.handler.database_handler){
                const exists = await this.config.handler.database_handler.getModel({ path: filePath, });
                if(exists !== null && exists !== undefined){
                    const modelDeleted = await this.config.handler.database_handler.deleteModel({ path: filePath, });
                    return modelDeleted;
                }
            }else{ return true; }
        }else{ return false; }
    }

    // Rename this file from it's depository and update the database.
    async rename(new_name){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        const renamed = await this.config.handler.renameFile({ name: this.config.name, ext: this.config.ext, folder: this.config.folder, new_name });
        if(renamed){
            if(this.config.handler.database_handler){
                const exists = await this.config.handler.database_handler.getModel({ path: filePath, });
                if(exists !== null && exists !== undefined){
                    const modelRenamed = await this.config.handler.database_handler.updateModel({ path: filePath, new_name });
                    return modelRenamed;
                }
            }else{ return true; }
        }else{ return false; }
    }

    // If file data is not encrypted according the database entry, encrypt it.
    // If no database is connected to check, encrypt it anyways.
    async protect(){
        try{
            if(this.config.isEncrypted == false && this.config.handler.file_protector !== null){
                // If a file protector is assigned.
                // If config approves data to be not encrypted.
                // Config is synced with the database.

                let doEncrypt = false;
                let model = null;
                let filePath = null;

                if(this.config.handler.database_handler){
                    // If a database is connected.
                    try{
                        const beautifiedPath = await this.beautifyPath(this.config.folder);
                        filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;
                        model = await this.config.handler.database_handler.getModel({ path: filePath, });
                        if(model !== null){
                            // If file entry exists.
                            if(model.isEncrypted == true){
                                // If entry approves the data to be encrypted but config denies.
                                // Case of Database - Local Mismatch
                                // Simply update the FCFile config
                                this.config.isEncrypted = true;
                                return true;
                            }else{ doEncrypt = true; } // If entry approves the data to be not encrypted.
                        }else{ doEncrypt = true; } // If entry does not exists. WARNING: This can result in double encryption.
                    }catch(error){ doEncrypt = false; } // If any other error occures.
                }else{ doEncrypt = true; } // If a database is not connected. WARNING: This can result in double encryption.

                if(doEncrypt == true){
                    // If encryption is allowed by the circumstances.

                    let didEncrypt = false;
                    let finalData = this.config.data;
                    let newData = finalData;

                    newData = await this.config.handler.file_protector.protect(finalData); // Get encrypted data.
                    if((newData.toString() === finalData.toString()) || newData == null){ didEncrypt = false; }else{ didEncrypt = true; }

                    if(didEncrypt == true){
                        // If data got encrypted.
                        this.config.data = newData;
                        this.config.isEncrypted = didEncrypt;

                        try{
                            // Replace file data with new encrypted data.
                            const response = await this.config.handler.replaceFileData({ file: this, new_data: newData, });
                        }catch(error){}

                        if(model !== null){
                            try{
                                // Update database entry.
                                await this.config.handler.database_handler.updateModel({ id: model.id, isEncrypted: didEncrypt, });
                            }catch(error){}
                        }
                    }

                    return didEncrypt;
                }
            }
        }catch(error){}

        return false;
    }

    // Creates new database entry for a file.
    async createModel(){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath == "/" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        if(this.config.handler.database_handler){
            // If a database is connected.
            const alreadyExists = await this.config.handler.database_handler.getModel({ path: filePath, });
            if(alreadyExists !== null && alreadyExists !== undefined){
                // If entry already exists, sync it's values.
                let modelUniqueData = {
                    id: alreadyExists.id,
                    path: alreadyExists.path,
                    isEncrypted: alreadyExists.isEncrypted,
                    isDeleted: alreadyExists.isDeleted,
                    created_at: alreadyExists.created_at,
                    deleted_at: alreadyExists.deleted_at,
                    updated_at: alreadyExists.updated_at,
                    user_id: alreadyExists.user_id,
                };

                this.config = {...this.config, ...modelUniqueData};
                return this;
            }else{
                // If entry does not exists, create one.
                //await this.protect(); // Protect data if configured to. protect() updates the config upon successful encryption.

                const newModel = await this.config.handler.database_handler.newModel({...this.config, user_id: this.config.handler.config.user_id, path: filePath, });

                let modelUniqueData = {
                    id: newModel.id,
                    path: newModel.path,
                    isEncrypted: newModel.isEncrypted,
                    isDeleted: newModel.isDeleted,
                    created_at: newModel.created_at,
                    deleted_at: newModel.deleted_at,
                    updated_at: newModel.updated_at,
                    user_id: newModel.user_id,
                };

                this.config = {...this.config, ...modelUniqueData};
                return this;
            }
        }else{ return null; }
    }

    async getContents(){
        return await this.config.handler.getFileContents(this);
    }
}

module.exports = FCFile;
