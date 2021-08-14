import Logger from './misc/logger.js';
import ObjectValidator from './misc/objectvalidator.js';

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

    async init(){
        // When creating a new FCFile, it is important to make sure folder path is ONLY A FOLDER PATH and not a FULL PATH (with basePath)
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "File", });

        if(validateConfig.success){
            const data = validateConfig.object;
            this.config.handler = data.handler;

            const folderPath = await this.config.handler.beautifyPath(data.folder, false);
            const beautifiedPath = await this.config.handler.beautifyPath(folderPath, true); // Full folder path
            const finalFileFullPath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${data.name}.${data.ext}`; // Full file path
            const finalFilePath = `${folderPath}${folderPath == "" ? "" : "/"}${data.name}.${data.ext}`;

            const size = await data.handler.getFileSize(finalFileFullPath);
            let iv = data.isEncrypted === true && size > 0 ? await data.handler.readFileIV(finalFileFullPath) : null;
            this.config = {...data, folder: folderPath, size, iv };

            if(this.config.handler.database_handler){
                try{
                    const model = await this.config.handler.database_handler.getModel({ path: finalFilePath, userId: this.config.handler.config.userId, });
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

                        iv = modelUniqueData.isEncrypted !== this.config.isEncrypted || (model.size !== this.config.size && model.size > 0) ? await data.handler.readFileIV(finalFileFullPath) : iv; // If IV was not read before, read it now.
                        this.config = {...this.config, ...modelUniqueData, iv};
                    }else{
                        await this.record(false);
                    }
                }catch(error){}
            }

            Logger.log("New FCFile initialized");
        }else{ Logger.log("New FCFile initialization failed"); }
    }

    // Delete this file from it's depository and update the database as per the configuration provided to the custodian.
    async delete(){
        const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
        const filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        const deleted = await this.config.handler.deleteFile({ path: filePath });

        if(deleted === true){
            this.config.isDeleted = true;
            if(this.config.handler.database_handler){
                const exists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                if(exists !== null && exists !== undefined){
                    const modelDeleted = await this.config.handler.database_handler.deleteModel({ path: filePath, userId: this.config.handler.config.userId, });
                    await this.refreshInformationFromDatabase();
                    return modelDeleted;
                }
            }else{ return true; }
        }

        return false;
    }

    // Rename this file from it's depository and update the database.
    async rename(newName){
        if(newName === this.config.name){ return false; };

        const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
        const filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        let doesFileWithNewNameAlreadyExists = await this.config.handler.getFile({ name: newName, ext: this.config.ext, folder: this.config.folder }); // This will log a NOTFOUND error
        if(doesFileWithNewNameAlreadyExists === null){
            const renamed = await this.config.handler.renameFile({ name: this.config.name, ext: this.config.ext, folder: this.config.folder, newName });

            if(renamed === true){
                this.config.name = newName;
                if(this.config.handler.database_handler){
                    const exists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
                    if(exists !== null && exists !== undefined){
                        const modelRenamed = await this.config.handler.database_handler.updateModel({ path: filePath, newName, userId: this.config.handler.config.userId, });
                        await this.refreshInformationFromDatabase();
                        return modelRenamed;
                    }
                }else{ return true; }
            }
        }

        return false;
    }

    // Copies this file and update the database.
    async copyToFolder(folderName){
        if(folderName === this.config.folder){ return null; };
        let doesFileAtNewPathAlreadyExists = await this.config.handler.getFile({ name: this.config.name, ext: this.config.ext, folder: folderName }); // This will log a NOTFOUND error
        if(doesFileAtNewPathAlreadyExists === null){
            return await this.config.handler.copyFile({ name: this.config.name, ext: this.config.ext, folder: this.config.folder, isEncrypted: this.config.isEncrypted, folderName });
        }

        return null;
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
                        const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
                        filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
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
                    let { contents, contentType, contentLength, readStream } = await this.getContents(false);

                    // Replace file contents with encrypted contents.
                    didEncrypt = await this.config.handler.replaceFileContents({ file: this, newContents: contents, readStream: readStream, doEncrypt: true, isStream: true, contentLength: contentLength, });
                    if(didEncrypt == true){
                        // If contents got encrypted.
                        this.config.isEncrypted = didEncrypt;

                        if(model !== null){
                            try{
                                // Update database entry.
                                await this.config.handler.database_handler.updateModel({ id: model.id, isEncrypted: didEncrypt, userId: this.config.handler.config.userId, });
                                await this.refreshInformationFromDatabase();
                            }catch(error){ Logger.log(error); }
                        }

                        await this.refreshInformationFromDepository({ iv: true, size: true });
                    }

                    return didEncrypt;
                }
            }
        }catch(error){ Logger.log(error); }

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
                        const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
                        filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
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
                                await this.refreshInformationFromDatabase();
                            }catch(error){ Logger.log(error); }
                        }

                        await this.refreshInformationFromDepository({ iv: false, size: true });
                    }

                    return didDecrypt;
                }
            }
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Creates new database entry for a file.
    async record(protect = true){
        const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
        const filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;

        if(this.config.handler.database_handler){
            // If a database is connected.
            const alreadyExists = await this.config.handler.database_handler.getModel({ path: filePath, userId: this.config.handler.config.userId, });
            if(alreadyExists !== null && alreadyExists !== undefined){
                // If entry already exists, sync it's values.
                return await this.refreshInformationFromDatabase();
            }else{
                // If entry does not exists, create one.
                protect === true ? await this.protect() : false; // Protect contents if configured to. protect() updates the config upon successful encryption.

                const newModel = await this.config.handler.database_handler.newModel({...this.config, userId: this.config.handler.config.userId, path: filePath, });
                return await this.refreshInformationFromDatabase();
            }
        }

        return false;
    }

    // Calls getFileContents function of it's handler which returns file contents.
    async getContents(){
        return await this.config.handler.getFileContents(this);
    }

    // Private function.
    // Refreshes information from the database.
    async refreshInformationFromDatabase(){
        try{
            if(this.config.handler.database_handler){
                const beautifiedPath = await this.config.handler.beautifyPath(this.config.folder, false);
                const filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`;
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
        }catch(error){ Logger.log(error); }
        return false;
    }

    // Private function.
    // Refreshes information from the depository.
    async refreshInformationFromDepository(valuesToRefresh){
        try{
            // Update IV and size.
            const folderPath = await this.config.handler.beautifyPath(this.config.folder, false);
            const beautifiedPath = await this.config.handler.beautifyPath(folderPath, true); // Full folder path
            const finalFileFullPath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${this.config.name}.${this.config.ext}`; // Full file path
            let iv = null;
            let size = 0;

            if(valuesToRefresh.iv === true){
                try{
                    iv = await this.config.handler.readFileIV(finalFileFullPath);
                }catch(error){ Logger.log(error); }
            }

            if(valuesToRefresh.size === true){
                try{
                    size = await this.config.handler.getFileSize(finalFileFullPath);
                }catch(error){ Logger.log(error); }

                if(size !== this.config.size){
                    try{
                        await this.config.handler.database_handler.updateModel({ id: this.config.id, size, userId: this.config.handler.config.userId, });
                    }catch(error){ Logger.log(error); }
                }
            }

            this.config = {...this.config, iv, size };
            return true;
        }catch(error){ Logger.log(error); }
        return false;
    }
}

export default FCFile;
