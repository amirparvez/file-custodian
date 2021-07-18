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
                await this.makeLocalDir(`${self.config.base_path}${validateConfig.object.folder.replace("FILE_EXTENSION_WISE", "")}`);
            }

            if(validateConfig.object.request){
                var requestFiles = await this.getFilesFromHttpRequest(validateConfig.object.request);
                var FCFiles = [];

                for(var requestFile of requestFiles){
                    var requestFileData = await this.getLocalFileData(requestFile.path);

                    if(requestFileData){
                        var requestFileName = requestFile.originalFilename;
                        var ext_regex = /(?:\.([^.]+))?$/;
                        var requestFileExt = ext_regex.exec(requestFileName)[1];
                        var fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());

                        await this.makeLocalDir(`${self.config.base_path}${fileFolder}`);

                        var newLocalFile = await this.makeLocalFile(`${self.config.base_path}${fileFolder}/${requestFileName}`, requestFileData);
                        if(newLocalFile){
                            var obj = { data: requestFileData, name: requestFileName, ext: requestFileExt, folder: fileFolder, handler: self, };
                            var newFCFile = await self.newFCFile(obj);
                            Config.debug ? console.log("New LSfile created") : false;
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }else{ }
                }

                return FCFiles.length > 0 ? FCFiles : null;
            }else{
                var fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", validateConfig.object.ext.toString().toLowerCase());
                
                await this.makeLocalDir(`${self.config.base_path}${fileFolder}`);

                var newLocalFile = await this.makeLocalFile(`${self.config.base_path}${fileFolder}/${validateConfig.object.name}.${validateConfig.object.ext}`, validateConfig.object.data);
                
                if(newLocalFile){ 
                    var obj = { data: validateConfig.object.data, name: validateConfig.object.name, ext: validateConfig.object.ext, folder: fileFolder, handler: self, };
                    var newFCFile = await self.newFCFile(obj);
                    Config.debug ? console.log("New LSfile created", newFCFile) : false;
                    return newFCFile; 
                }

                Config.debug ? console.log("New LSfile creation failed") : false;
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

            var response = await this.deleteLocalFile(`${self.config.base_path}${pathToFile}`);
            if(response){ Config.debug ? console.log("LSfile deleted") : false; return true; }

            Config.debug ? console.log("LSfile deletion failed") : false; return false;
        }else{ Config.debug ? console.log("LSfile deletion failed") : false; return false; }
    }

    async renameFile(options){
        // options: 
        // 1. old path & new path
        // 2. name,ext,folder & new path
        // 3. name,ext,folder & new name
        
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_RenameFile", });
        if(validateConfig.success){
            var pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder ? `${validateConfig.object.folder}/${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            var newPath = validateConfig.object.new_path ? validateConfig.object.new_path : (
                validateConfig.object.new_name && validateConfig.object.ext && validateConfig.object.folder ? `${validateConfig.object.folder}/${validateConfig.object.new_name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return false;
            }

            var response = await this.renameLocalFile(`${self.config.base_path}${pathToFile}`, `${self.config.base_path}${newPath}`);
            if(response){ Config.debug ? console.log("LSfile renamed") : false; return true; }

            Config.debug ? console.log("LSfile renaming failed") : false; return false;
        }else{ Config.debug ? console.log("LSfile renaming failed") : false; return false; }
    }

    async getFile(options){
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            var pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder ? `${validateConfig.object.folder}/${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            var file = await this.getLocalFile(`${self.config.base_path}${pathToFile}`);
            if(file){ return await self.newFCFile({...file, handler:self}); }
        }

        return null;
    }

    async searchFiles(options){
        var self = this;
        var validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            var pathToFile = validateConfig.object.folder;

            var files = await this.searchLocalFiles(`${self.config.base_path}${pathToFile}`, validateConfig.object.query);
            if(files){ 
                var FCFiles = [];
                for(var file of files){
                    FCFiles.push(await self.newFCFile({...file, handler:self}));
                }

                return FCFiles;
            }
        }

        return [];
    }

    async getFileSize(path){
        return await this.getLocalFileSize(path);
    }

    async syncDB(){
        try{
            var files = await this.getAllFilesOfLocalDirectory(this.config.base_path);
            console.log(files);

            var filesWithInformation = [];
            for(var file of files){
                try{
                    var data = await this.getLocalFile(file);
                    var FCFile = await this.newFCFile({...data, handler:this});
                    var FCFileWithModelData = await FCFile.createModel();
                    FCFileWithModelData ? filesWithInformation.push(FCFileWithModelData) : false;
                }catch(error){continue;}
            }

            return filesWithInformation;
        }catch(error){
            return [];
        }
    }
}

module.exports = FCLocalServerFileHandler;