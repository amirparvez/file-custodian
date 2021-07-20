import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCLocalServerFileHandler from './localserverfilehandler';
import FCAWSS3FileHandler from './awss3filehandler';

class FCCustodian{
    constructor(config){
        this.config_provided = config;
        this.config = {
            name: null,
        };

        this.file_handlers = [];
        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "Custodian", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New custodian initialized`) : false;
        }else{ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New custodian initialization failed`) : false; }
    }

    resetDefaultFH(fileHandlerName){
        var self = this;
        var fhToSetAsDefault = self.file_handlers.find(x => {return x.name === fileHandlerName});
        if(fhToSetAsDefault){
            for(var fh of self.file_handlers){
                fh.isDefault = fh.name === fileHandlerName ? true : false;
            }

            return true;
        }else{ throw Errors.find(x => {return x.abbr == "c_ifh"}).errorObj; }
    }

    activateFH(fileHandlerName){
        var fhToActivate = this.file_handlers.find(x => {return x.name === fileHandlerName});
        if(fhToActivate && fhToActivate.handler){
            return fhToActivate.handler;
        }else{ throw Errors.find(x => {return x.abbr == "c_ifh"}).errorObj; }
    }

    dep(fileHandlerName){
        return this.activateFH(fileHandlerName);
    }

    async newDepository(options){
        if(options && typeof options === "object" && typeof options.name === "string" && typeof options.isDefault === "boolean"){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "FileHandler", });

            if(!validateConfig.success){ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New file handler creation failed`) : false; }

            if(validateConfig.object.type == "local-server"){
                await this.file_handlers.push({
                    name: options.name,
                    isDefault: options.isDefault,
                    handler: new FCLocalServerFileHandler({ type: validateConfig.object.type, base_path: validateConfig.object.base_path, }),
                });
            }else{
                if(validateConfig.object.type == "aws-s3"){
                    await this.file_handlers.push({
                        name: options.name,
                        isDefault: options.isDefault,
                        handler: new FCAWSS3FileHandler({ type: validateConfig.object.type, base_path: validateConfig.object.base_path, }),
                    });
                }
            }

            options.isDefault ? await this.resetDefaultFH(options.name) : false;
            this.activateFH(options.name);

            if(validateConfig.success){ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New file handler created`) : false; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_ifho"}).errorObj; }else{ return null; } }
    }

    async getFileSchemaNameFromFH(fh){
        return fh.config.type == "local-server" ? "LSFile" : "File";
    }

    async newFile(options){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var fileSchemaName = await this.getFileSchemaNameFromFH(defaultFH.handler);
            var validateConfig = await ObjectValidator.validate({ object: options, against: fileSchemaName, });
            if(validateConfig.success){
                var file = await defaultFH.handler.newFile(options);
                if(file){ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New ${fileSchemaName} created`) : false; }else{ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New ${fileSchemaName} creation failed`) : false; }

                return file;
            }else{ Config.debug ? console.log(`[CUSTODIAN:${this.config.name}] New ${fileSchemaName} creation failed`) : false; }
        }else{
            if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idfh"}).errorObj; }else{ return null; }
        }
    }

    async getFile(options){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
            if(validateConfig.success){
                var file = await defaultFH.handler.getFile(options);
                return file;
            }else{ return null; }
        }else{ return null; }
    }

    async renameFile(options){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_RenameFile", });
            if(validateConfig.success){
                var response = await defaultFH.handler.renameFile(options);
                return response;
            }else{ return false; }
        }else{ return false; }
    }

    async deleteFile(options){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteFile", });
            if(validateConfig.success){
                var response = await defaultFH.handler.deleteFile(options);
                return response;
            }else{ return false; }
        }else{ return false; }
    }

    async searchFiles(options){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
            if(validateConfig.success){
                var files = await defaultFH.handler.searchFiles(options);
                return files;
            }else{ return []; }
        }else{ return []; }
    }

    async getFileSize(path){
        var defaultFH = this.file_handlers.find(x => {return x.isDefault === true});
        if(defaultFH && defaultFH.handler){
            var size = await defaultFH.handler.getFileSize(path);
            return size;
        }else{ return 0; }
    }
}

module.exports = FCCustodian;
