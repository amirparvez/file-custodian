import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCMongoDBHandler from './mongodbhandler';
import FCMySQLHandler from './mysqlhandler';
import FCFile from './file';
import FCFileProtector from './fileprotector';

const fs = require("fs");
const path = require('path');
const multiparty = require('multiparty');

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            type: null,
            base_path: null,
        };

        this.database_handler = null;
        this.file_protector = null;

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.type == "local-server"){
                await this.makeLocalDir(this.config.base_path);
            }

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    db(){
        return this.database_handler;
    }

    async newDatabase(options){
        if(options && typeof options === "object"){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "DatabaseHandler", });

            if(!validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New database handler creation failed`) : false; }

            if(validateConfig.object.system == "mysql" || validateConfig.object.system == "postgres" || validateConfig.object.system == "mariadb"){
                this.database_handler = new FCMySQLHandler({ system: validateConfig.object.system, database: validateConfig.object.database, username: validateConfig.object.username, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, table_name: validateConfig.object.table_name, proper_delete: validateConfig.object.proper_delete, });
            }else{
                if(validateConfig.object.system == "mongodb"){
                    this.database_handler = new FCMongoDBHandler({ system: validateConfig.object.system, database: validateConfig.object.database, username: validateConfig.object.username, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, table_name: validateConfig.object.table_name, proper_delete: validateConfig.object.proper_delete, });
                }
            }

            if(validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New database handler created`) : false; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idbho"}).errorObj; }else{ return null; } }
    }

    async newProtector(options){
        if(options && typeof options === "object"){
            var validateConfig = await ObjectValidator.validate({ object: options, against: "FileProtector", });

            if(!validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New file protector creation failed`) : false; }

            this.file_protector = new FCFileProtector({ algorithm: validateConfig.object.algorithm, key: validateConfig.object.key, initialization_vector: validateConfig.object.initialization_vector, });

            if(validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New file protector created`) : false; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_ifpo"}).errorObj; }else{ return null; } }
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

    async getLocalFileSize(path) {
        var response = await fs.promises.stat(path).then(data => {
            return data.size;
        }).catch(error => {
            return 0;
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

                var filteredFiles = [];
                var querySplit = query ? query.toLowerCase().split(":") : [null, null];
                var queryType = querySplit[0];
                var queryParam = querySplit[1];

                if(query !== null && typeof query === "string"){
                    if(queryType === "extension"){
                        filteredFiles = files.filter(file => {
                            return path.extname(file).replace(".", "").toLowerCase() === queryParam;
                        });
                    }else{
                        if(queryType === "name"){
                            filteredFiles = files.filter(file => {
                                return file.replace(path.extname(file), "").toLowerCase() === queryParam;
                            });
                        }else{
                            if(queryType === "name_contains"){
                                filteredFiles = files.filter(file => {
                                    return file.replace(path.extname(file), "").toLowerCase().includes(queryParam);
                                });
                            }else{ filteredFiles = files; }
                        }
                    }
                }else{ filteredFiles = files; }

                var finalFiles = [];
                for(var file of filteredFiles){
                    var fileObj = await this.getLocalFile(dirPath+"/"+file);
                    if(fileObj){
                        finalFiles.push(fileObj);
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
                var folderPath = parsedPath.dir.replace(this.config.base_path, "");
                var obj = { data: data, name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath == "" ? "/" : folderPath, };

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
            await newFile.init();
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

    async getAllFilesOfLocalDirectory(path){
        var items = await fs.promises.readdir(path).then(async data => {
            var files = [];
            for(var item of data){
                var isItemDir = await fs.promises.stat(`${path}/${item}`).then(stats => {return stats.isDirectory()}).catch(error => {return false;});
                if(isItemDir){
                    var filesOfCurrentDir = await this.getAllFilesOfLocalDirectory(`${path}/${item}`, null);
                    files = [...files, ...filesOfCurrentDir];
                }else{
                    files.push(`${path}/${item}`);
                }
            }

            return files;
        }).catch(error => {
            return [];
        });

        return items;
    };
}

module.exports = FCFileHandler;
