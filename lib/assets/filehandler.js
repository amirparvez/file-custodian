import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCFile from './file';

const fs = require("fs");
const path = require('path');
const multiparty = require('multiparty');

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            depository: null,
            base_path: null,
        };

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.depository == "local-server"){
                await this.makeLocalDir(this.config.base_path);
            }

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    async makeLocalDir(path){
        if(!fs.existsSync(path)){
            var response = await fs.promises.mkdir(path, { recursive: true }).then(msg => {
                return true;
            }).catch(error => {
                return false;
            });

            return response;
        }

        return true;
    }

    async makeLocalFile(path, data){
        var response = await fs.promises.writeFile(path, data).then(async msg => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    async doesLocalPathExists(path){
        return await fs.promises.access(path).then(data => {
            return true;
        }).catch(error => {
            return false;
        });
    }

    async isLocalPathOfFile(path){  
        return await fs.promises.stat(path).then(data => {
            return data.isFile();
        }).catch(error => {
            return false;
        });
    }

    async isLocalPathOfDirectory(path){  
        return await fs.promises.stat(path).then(data => {
            return data.isDirectory();
        }).catch(error => {
            return false;
        });
    }

    async searchLocalFiles(dirPath, query){
        var isValid = await this.doesLocalPathExists(dirPath);
        if(isValid){
            var isDir = await this.isLocalPathOfDirectory(dirPath);
            if(isDir){
                var files = await fs.promises.readdir(dirPath).then(data => {
                    return data;
                }).catch(error => {
                    return [];
                });

                var finalFiles = [];
                for(var file of files){
                    var fileObj = await this.getLocalFile(dirPath+"/"+file);
                    if(fileObj){
                        if(query !== null && typeof query === "string"){
                            var querySplit = query.toLowerCase().split(":");
                            var queryType = querySplit[0];
                            var queryParam = querySplit[1];

                            if(queryType === "extension"){
                                if(fileObj.ext.toString().toLowerCase() === queryParam){ finalFiles.push(fileObj); }
                            }
                        }
                        else{ 
                            finalFiles.push(fileObj); 
                        }
                    }
                }

                return finalFiles;
            }else{ return []; }
        }else{ return []; }
    }

    async getLocalFile(fpath){
        var isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            var isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                var data = await this.getLocalFileData(fpath);
                var parsedPath = path.parse(fpath);
                var obj = { data: data, name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: parsedPath.dir.replace(this.config.base_path, ""), };

                return obj;
            }else{ return null; }
        }else{ return null; }
    }

    async getLocalFileData(path){
        var data = await fs.promises.readFile(path).then(async data => {
            return data;
        }).catch(error => {
            return null;
        });

        return data;
    }

    async deleteLocalFile(path){
        var response = fs.promises.rm(path).then(async (msg) => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    async renameLocalFile(path, new_path){
        var response = fs.promises.rename(path, new_path).then(async (msg) => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    async newFCFile(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "File", });

        if(validateConfig.success){
            var newFile = new FCFile(options);
            Config.debug ? console.log("New FCFile created") : false;

            return newFile;
        }else{ Config.debug ? console.log("New FCFile creation failed") : false; return null; }

        return null;
    }

    async getFilesFromHttpRequest(request){
        if(request){
            try{
                var form = new multiparty.Form();
                var files = await new Promise(function(resolve, reject){
                    form.parse(request, function(error, fields, files){
                        if(error){ reject(null); }
                        resolve(files);
                    });
                });

                Config.debug ? console.log("Extraction of files from HTTP request successful") : false;
                return files.file ? files.file : [];
            }catch(error){
                Config.debug ? console.log("Extraction of files from HTTP request failed") : false; 
                return [];
            }
        }else{ Config.debug ? console.log("Extraction of files from HTTP request failed") : false; return []; }
    }
}

module.exports = FCFileHandler;