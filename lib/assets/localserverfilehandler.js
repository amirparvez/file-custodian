import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

const fs = require("fs");

class FCLocalServerFileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);
    }

    async newFile(options){
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: options, against: "LSFile", });

        if(validateConfig.success){
            if(validateConfig.object.folder !== "/"){
                if(!fs.existsSync(`${self.config.base_path}${validateConfig.object.folder}`)){
                    await fs.promises.mkdir(`${self.config.base_path}${validateConfig.object.folder}`, { recursive: true }).then(msg => {
                        console.log(msg);
                    }).catch(error => {
                        console.log(error);
                    });
                }
            }

            if(validateConfig.request){
                var files = await this.getFilesFromHttpRequest(validateConfig.request);
                var fcFiles = [];

                for(var file of files){
                    var fcFile = await fs.promises.writeFile(`${self.config.base_path}${validateConfig.object.folder}/${file.orginalFileName}`, file.headers).then(async (msg) => {
                        var file = await self.newFCFile({...validateConfig.object, handler: self, });
                        Config.debug ? console.log("New LSfile created") : false;
                        return file;
                    }).catch(error => {
                        console.log(error);
                        return null;
                    });

                    fcFile ? fcFiles.push(fcFile) : false;
                }

                return fcFiles;
            }else{
                return await fs.promises.writeFile(`${self.config.base_path}${validateConfig.object.folder}/${validateConfig.object.name}.${validateConfig.object.ext}`, validateConfig.object.data).then(async (msg) => {
                    var file = await self.newFCFile({...validateConfig.object, handler: self, });
                    Config.debug ? console.log("New LSfile created") : false;
                    return file;
                }).catch(error => {
                    console.log(error);
                    return null;
                });

                return null;
            }
        }else{ Config.debug ? console.log("New LSfile creation failed") : false; }
    }

    async deleteFile(options){
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteFile", });
        if(validateConfig.success){
            var pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder ? `${validateConfig.object.folder}/${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null){
                return false;
            }

            return await fs.promises.rm(`${self.config.base_path}${pathToFile}`).then(async (msg) => {
                Config.debug ? console.log("LSfile deleted") : false;
                return true;
            }).catch(error => {
                console.log(error);
                return false;
            });
        }else{ Config.debug ? console.log("LSfile deletion failed") : false; return false; }
    }
}

module.exports = FCLocalServerFileHandler;