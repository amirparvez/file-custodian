import Config from '../config.json';
import Errors from './errors.js';

import ObjectValidator from './objectvalidator.js';

class FCFile{
    constructor(config){
        this.config_provided = config;
        this.config = {
            id: null,
            name: null,
            ext: null,
            size: null,
            folder: null,
            path: null,
            isEncrypted: null,
            isDeleted: null,
            created_at: null,
            updated_at: null,
            deleted_at: null,
            userId: null,
            iv: null,
            handler: null,
        };
    }

    // Private function.
    // Fixes any errors in a folder path.
    // Folder path must never start or end with a '/'.
    async beautifyPath(path){
        let finalPath = "";

        finalPath = path.replace(/\\/g, "/"); // Convert back slashes to forward slashes.
        finalPath = finalPath.replace(/\/\//g, '/'); // Convert each double slashes to a single slash

        if(finalPath.charAt(0) == '/'){
            // Remove the first forward slash
            finalPath = finalPath.substring(1);
        }else{}

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
            const filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${data.name}.${data.ext}`;
            const finalFilePath = `${data.handler.config.basePath}${data.handler.config.basePath === "" ? "" : "/"}${filePath}`;

            const size = await data.handler.getFileSize(finalFilePath);
            let iv = data.isEncrypted === true ? await data.handler.readFileIV(finalFilePath) : null;
            this.config = {...data, folder: beautifiedPath, size, iv };

            if(this.config.handler.database_handler){
                try{
                    const model = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
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
                            userId: model.userId,
                        };

                        iv = model.isEncrypted === true ? await data.handler.readFileIV(finalFilePath) : null;
                        this.config = {...this.config, ...modelUniqueData, iv};
                    }else{
                        await this.record();
                    }
                }catch(error){}
            }

            Config.debug ? console.log("New FCFile initialized") : false;
        }else{ Config.debug ? console.log("New FCFile initialization failed") : false; }
    }

    // Delete this file from it's depository and update the database as per the configuration provided to the custodian.
    async delete(){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        const deleted = await this.config.handler.deleteFile({ path: filePath });
        this.config.isDeleted = true;

        if(deleted){
            if(this.config.handler.database_handler){
                const exists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                if(exists !== null && exists !== undefined){
                    const modelDeleted = await this.config.handler.database_handler.deleteModel({ path: filePath, userId: this.config.handler.config.userId, });
                    await this.refreshModelInformation();
                    return modelDeleted;
                }
            }else{ return true; }
        }else{ return false; }
    }

    // Rename this file from it's depository and update the database.
    async rename(newName){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        const renamed = await this.config.handler.renameFile({ name: this.config.name, ext: this.config.ext, folder: this.config.folder, newName });
        this.config.name = newName;

        if(renamed){
            if(this.config.handler.database_handler){
                const exists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                if(exists !== null && exists !== undefined){
                    const modelRenamed = await this.config.handler.database_handler.updateModel({ path: filePath, newName, userId: this.config.handler.config.userId, });
                    await this.refreshModelInformation();
                    return modelRenamed;
                }
            }else{ return true; }
        }else{ return false; }
    }

    // If file contents are not encrypted according the database entry, encrypt them.
    // If no database is connected to check, encrypt them anyways.
    async protect(){
        try{
            if(this.config.isEncrypted == false && this.config.handler.file_protector !== null){
                // If a file protector is assigned.
                // If config approves contents to be not encrypted.
                // Config is synced with the database.

                let doEncrypt = false;
                let model = null;
                let filePath = null;

                if(this.config.handler.database_handler){
                    // If a database is connected.
                    try{
                        const beautifiedPath = await this.beautifyPath(this.config.folder);
                        filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
                        model = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                        if(model !== null){
                            // If file entry exists.
                            if(model.isEncrypted == true){
                                // If entry approves the contents to be encrypted but config denies.
                                // Case of Database - Local Mismatch
                                // Simply update the FCFile config
                                this.config.isEncrypted = true;
                                return true;
                            }else{ doEncrypt = true; } // If entry approves the contents to be not encrypted.
                        }else{ doEncrypt = true; } // If entry does not exists. WARNING: This can result in double encryption.
                    }catch(error){ doEncrypt = false; } // If any other error occures.
                }else{ doEncrypt = true; } // If a database is not connected. WARNING: This can result in double encryption.

                if(doEncrypt == true){
                    // If encryption is allowed by the circumstances.

                    let didEncrypt = false;
                    let { contents, contentType, contentLength, readStream } = await this.getContents();

                    // Replace file contents with encrypted contents.
                    didEncrypt = await this.config.handler.replaceFileContents({ file: this, newContents: contents, readStream: readStream, doEncrypt: true, isStream: true, contentLength: contentLength, });
                    if(didEncrypt == true){
                        // If contents got encrypted.
                        this.config.isEncrypted = didEncrypt;

                        if(model !== null){
                            try{
                                // Update database entry.
                                await this.config.handler.database_handler.updateModel({ id: model.id, isEncrypted: didEncrypt, userId: this.config.handler.config.userId, });
                                await this.refreshModelInformation();
                            }catch(error){ Config.debug ? console.log(error) : false; }
                        }
                    }

                    return didEncrypt;
                }
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // If file contents are encrypted according the database entry, decrypt them.
    // If no database is connected to check, decrypt them anyways.
    async unprotect(){
        try{
            if(this.config.isEncrypted == true && this.config.handler.file_protector !== null){
                // If a file protector is assigned.
                // If config approves contents to be encrypted.
                // Config is synced with the database.

                let doDecrypt = false;
                let model = null;
                let filePath = null;

                if(this.config.handler.database_handler){
                    // If a database is connected.
                    try{
                        const beautifiedPath = await this.beautifyPath(this.config.folder);
                        filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
                        model = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                        if(model !== null){
                            // If file entry exists.
                            if(model.isEncrypted == false){
                                // If entry approves the contents to be unencrypted but config denies.
                                // Case of Database - Local Mismatch
                                // Simply update the FCFile config
                                this.config.isEncrypted = false;
                                return true;
                            }else{ doDecrypt = true; } // If entry approves the contents to be encrypted.
                        }else{ doDecrypt = true; } // If entry does not exists. WARNING: This can result in double decryption.
                    }catch(error){ doDecrypt = false; } // If any other error occures.
                }else{ doDecrypt = true; } // If a database is not connected. WARNING: This can result in double decryption.

                if(doDecrypt == true){
                    // If decryption is allowed by the circumstances.

                    let didDecrypt = false;
                    let { contents, contentType, contentLength, readStream } = await this.getContents(); // getContents() always returns decrypted contents

                    // Replace file contents with decrypted contents.
                    didDecrypt = await this.config.handler.replaceFileContents({ file: this, newContents: contents, readStream: readStream, doEncrypt: false, isStream: true, contentLength: contentLength, });
                    if(didDecrypt == true){
                        // If contents got decrypted.
                        this.config.isEncrypted = didDecrypt === true ? false : true;

                        if(model !== null){
                            try{
                                // Update database entry.
                                await this.config.handler.database_handler.updateModel({ id: model.id, isEncrypted: didDecrypt === true ? false : true, userId: this.config.handler.config.userId, });
                                await this.refreshModelInformation();
                            }catch(error){ Config.debug ? console.log(error) : false; }
                        }
                    }

                    return didDecrypt;
                }
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Creates new database entry for a file.
    async record(){
        const beautifiedPath = await this.beautifyPath(this.config.folder);
        const filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        if(this.config.handler.database_handler){
            // If a database is connected.
            const alreadyExists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
            if(alreadyExists !== null && alreadyExists !== undefined){
                // If entry already exists, sync it's values.
                return await this.refreshModelInformation();
            }else{
                // If entry does not exists, create one.
                await this.protect(); // Protect contents if configured to. protect() updates the config upon successful encryption.

                const newModel = await this.config.handler.database_handler.newModel({...this.config, userId: this.config.handler.config.userId, path: filePath, });
                return await this.refreshModelInformation();
            }
        }else{ }

        return false;
    }

    // Calls getFileContents function of it's handler which returns file contents.
    async getContents(){
        return await this.config.handler.getFileContents(this);
    }

    // Private function.
    // Refreshes information from the database.
    async refreshModelInformation(){
        try{
            if(this.config.handler.database_handler){
                const beautifiedPath = await this.beautifyPath(this.config.folder);
                const filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
                const model = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });

                if(model){
                    let modelUniqueData = {
                        id: model.id,
                        path: model.path,
                        isEncrypted: model.isEncrypted,
                        isDeleted: model.isDeleted,
                        created_at: model.created_at,
                        deleted_at: model.deleted_at,
                        updated_at: model.updated_at,
                        userId: model.userId,
                    };

                    this.config = {...this.config, ...modelUniqueData};
                    return true;
                }
            }
        }catch(error){ Config.debug ? console.log(error) : false; }
        return false;
    }
}

export default FCFile;
