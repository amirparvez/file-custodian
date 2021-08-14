import Logger from './misc/logger.js';
import ObjectValidator from './misc/objectvalidator.js';
import FCLocalServerFileHandler from './filehandlers/localserverfilehandler.js';
import FCAWSS3FileHandler from './filehandlers/awss3filehandler.js';
import FCMegaFileHandler from './filehandlers/megafilehandler.js';

class FCCustodian{
    constructor(config){
        this.config_provided = config;
        this.config = {
            name: null,
        };

        this.file_handlers = []; // Custodian can have multiple file handlers identified by their names.
        this.initCustodian();
    }

    async initCustodian(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "Custodian", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Logger.log(`[CUSTODIAN:${this.config.name}] New custodian initialized`);
        }else{ Logger.log(`[CUSTODIAN:${this.config.name}] New custodian initialization failed`); }
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
        }else{ Logger.error("c_ifh"); }
    }

    // Private function.
    // Activating a file handler is no more supported therefore it returns a specific file handler.
    activateFH(fileHandlerName){
        const fhToActivate = this.file_handlers.find(x => {return x.name === fileHandlerName});
        if(fhToActivate && fhToActivate.handler){
            return fhToActivate.handler;
        }else{ Logger.error("c_ifh"); }
    }

    // Returns a specific file handler.
    depository(fileHandlerName){
        return this.activateFH(fileHandlerName);
    }

    // Creates new depository/file handler.
    async newDepository(options){
        if(options && typeof options === "object" && typeof options.name === "string" && typeof options.isDefault === "boolean"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "FileHandler", });

            if(!validateConfig.success){ Logger.log(`[CUSTODIAN:${this.config.name}] New file handler creation failed`); }

            if(validateConfig.object.type === "local-server"){
                await this.file_handlers.push({
                    name: options.name,
                    isDefault: options.isDefault,
                    handler: new FCLocalServerFileHandler({ name: options.name, type: validateConfig.object.type, basePath: validateConfig.object.basePath, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                });
            }else{
                if(validateConfig.object.type === "aws-s3" || validateConfig.object.type === "do-spaces" || validateConfig.object.type === "bb-b2"){
                    await this.file_handlers.push({
                        name: options.name,
                        isDefault: options.isDefault,
                        handler: new FCAWSS3FileHandler({ name: options.name, type: validateConfig.object.type, basePath: validateConfig.object.basePath, bucketName: validateConfig.object.bucketName, bucketRegion: validateConfig.object.bucketRegion, key: validateConfig.object.key, keyId: validateConfig.object.keyId, endpoint: validateConfig.object.endpoint, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                    });
                }else{
                    if(validateConfig.object.type === "mega"){
                        await this.file_handlers.push({
                            name: options.name,
                            isDefault: options.isDefault,
                            handler: new FCMegaFileHandler({ name: options.name, type: validateConfig.object.type, basePath: validateConfig.object.basePath, email: validateConfig.object.email, password: validateConfig.object.password, encryptingSpeed: validateConfig.object.encryptingSpeed, readingSpeed: validateConfig.object.readingSpeed, writingSpeed: validateConfig.object.writingSpeed, }),
                        });
                    }
                }
            }

            options.isDefault ? await this.resetDefaultFH(options.name) : false;

            if(validateConfig.success){ Logger.log(`[CUSTODIAN:${this.config.name}] New file handler created`); return true; }
        }else{ Logger.error("c_ifho"); return false; }
    }

    // Returns database_handler of default file handler.
    async database(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return defaultFH.handler.database_handler;
        }else{ Logger.error("c_idfh"); return null; }
    }

    // Calls init function of default file handler.
    async init(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.init();
        }else{ Logger.error("c_idfh"); }

        return false;
    }

    // Calls user function of default file handler.
    user(userId){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return defaultFH.handler.user(userId);
        }else{ Logger.error("c_idfh"); return null; }
    }

    // Calls newDatabase function of default file handler.
    async newDatabase(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.newDatabase(options);
        }else{ Logger.error("c_idfh"); return false; }
    }

    // Calls newProtector function of default file handler.
    async newProtector(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            return await defaultFH.handler.newProtector(options);
        }else{ Logger.error("c_idfh"); return false; }
    }

    // Calls newFile function of default file handler.
    async newFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let file = await defaultFH.handler.newFile(options);
            return file;
        }else{ Logger.error("c_idfh"); return null; }
    }

    // Calls getFile function of default file handler.
    async getFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let file = await defaultFH.handler.getFile(options);
            return file;
        }else{ Logger.error("c_idfh"); return null; }
    }

    // Calls renameFile function of default file handler.
    async renameFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.renameFile(options);
            return response;
        }else{ Logger.error("c_idfh"); return false; }
    }

    // Calls deleteFile function of default file handler.
    async deleteFile(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.deleteFile(options);
            return response;
        }else{ Logger.error("c_idfh"); return false; }
    }

    // Calls searchFiles function of default file handler.
    async searchFiles(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let files = await defaultFH.handler.searchFiles(options);
            return files;
        }else{ Logger.error("c_idfh"); return []; }
    }

    // Calls getFileSize function of default file handler.
    async getFileSize(path){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let size = await defaultFH.handler.getFileSize(path);
            return size;
        }else{ Logger.error("c_idfh"); return 0; }
    }

    // Calls syncDatabase function of default file handler.
    async syncDatabase(){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let files = await defaultFH.handler.syncDatabase();
            return files;
        }else{ Logger.error("c_idfh"); return []; }
    }

    // Private function.
    // Calls replaceFileContents function of default file handler.
    async replaceFileContents(options){
        const defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            let response = await defaultFH.handler.replaceFileContents(options);
            return response;
        }else{ Logger.error("c_idfh"); return false; }
    }
}

export default FCCustodian;
