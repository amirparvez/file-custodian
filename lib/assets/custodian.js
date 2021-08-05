import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCLocalServerFileHandler from './localserverfilehandler';
import FCAWSS3FileHandler from './awss3filehandler';
import FCMegaFileHandler from './megafilehandler';

class FCCustodian{
    constructor(config){
        this.config_provided = config;
        this.config = {
            name: null,
        };

        this.file_handlers = []; // Custodian can have multiple file handlers identified by their names.
        this.init();
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "Custodian", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New custodian initialized`) : false;
        }else{ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New custodian initialization failed`) : false; }
    }

    // Private function.
    // Resets default file handler.
    resetDefaultFH(fileHandlerName){
        const self = this;
        const fhToSetAsDefault = self.file_handlers.find(x => {return x.name === fileHandlerName});
        if(fhToSetAsDefault){
            for(let fh of self.file_handlers){
                fh.isDefault = fh.name === fileHandlerName ? true : false;
            }

            return true;
        }else{ throw Errors.find(x => {return x.abbr == "c_ifh"}).errorObj; }
    }

    // Private function.
    // Activating a file handler is no more supported therefore it returns a specific file handler.
    activateFH(fileHandlerName){
        const fhToActivate = this.file_handlers.find(x => {return x.name === fileHandlerName});
        if(fhToActivate && fhToActivate.handler){
            return fhToActivate.handler;
        }else{ throw Errors.find(x => {return x.abbr == "c_ifh"}).errorObj; }
    }

    // Returns a specific file handler.
    depository(fileHandlerName){
        return this.activateFH(fileHandlerName);
    }

    // Creates new depository/file handler.
    async newDepository(options){
        if(options && typeof options === "object" && typeof options.name === "string" && typeof options.isDefault === "boolean"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "FileHandler", });

            if(!validateConfig.success){ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New file handler creation failed`) : false; }

            if(validateConfig.object.type === "local-server"){
                await this.file_handlers.push({
                    name: options.name,
                    isDefault: options.isDefault,
                    handler: new FCLocalServerFileHandler({ type: validateConfig.object.type, basePath: validateConfig.object.basePath, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                });
            }else{
                if(validateConfig.object.type === "aws-s3" || validateConfig.object.type === "do-spaces"){
                    await this.file_handlers.push({
                        name: options.name,
                        isDefault: options.isDefault,
                        handler: new FCAWSS3FileHandler({ type: validateConfig.object.type, basePath: validateConfig.object.basePath, bucketName: validateConfig.object.bucketName, bucketRegion: validateConfig.object.bucketRegion, key: validateConfig.object.key, keyId: validateConfig.object.keyId, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                    });
                }else{
                    if(validateConfig.object.type === "mega"){
                        await this.file_handlers.push({
                            name: options.name,
                            isDefault: options.isDefault,
                            handler: new FCMegaFileHandler({ type: validateConfig.object.type, basePath: validateConfig.object.basePath, email: validateConfig.object.email, password: validateConfig.object.password, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                        });
                    }
                }
            }

            options.isDefault ? await this.resetDefaultFH(options.name) : false;

            if(validateConfig.success){ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New file handler created`) : false; return true; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_ifho"}).errorObj; }else{ return null; } }
    }

    // Private function.
    // Returns file schema name based on depository/file handler type.
    // Not used anymore.
    async getFileSchemaNameFromFH(fh){
        return fh.config.type == "local-server" ? "LSFile" : "File";
    }

    // Returns database_handler of default file handler.
    async database(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return defaultFH.handler.database_handler;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return null; } }
    }

    // Calls init function of default file handler.
    async init(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.init();
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }

    // Calls user function of default file handler.
    user(userId){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return defaultFH.handler.user(userId);
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return null; } }
    }

    // Calls newDatabase function of default file handler.
    async newDatabase(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.newDatabase(options);
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }

    // Calls newProtector function of default file handler.
    async newProtector(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.newProtector(options);
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }

    // Calls newFile function of default file handler.
    async newFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            //var fileSchemaName = await this.getFileSchemaNameFromFH(defaultFH.handler);
            let file = await defaultFH.handler.newFile(options);
            return file;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return null; } }
    }

    // Calls getFile function of default file handler.
    async getFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let file = await defaultFH.handler.getFile(options);
            return file;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return null; } }
    }

    // Calls renameFile function of default file handler.
    async renameFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.renameFile(options);
            return response;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }

    // Calls deleteFile function of default file handler.
    async deleteFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.deleteFile(options);
            return response;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }

    // Calls searchFiles function of default file handler.
    async searchFiles(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let files = await defaultFH.handler.searchFiles(options);
            return files;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return []; } }
    }

    // Calls getFileSize function of default file handler.
    async getFileSize(path){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let size = await defaultFH.handler.getFileSize(path);
            return size;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return 0; } }
    }

    // Calls syncDatabase function of default file handler.
    async syncDatabase(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let files = await defaultFH.handler.syncDatabase();
            return files;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return []; } }
    }

    // Private function.
    // Calls replaceFileContents function of default file handler.
    async replaceFileContents(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.replaceFileContents(options);
            return response;
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return false; } }
    }
}

module.exports = FCCustodian;
