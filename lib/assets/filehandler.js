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
            user_id: null,
        };

        this.database_handler = null; // File handler can have one database handler.
        this.file_protector = null; // File handler can have one file protector.

        this.init();
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.type == "local-server"){
                await this.makeLocalDir(this.config.base_path);
            }

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    // Returns the database handler.
    db(){
        return this.database_handler;
    }

    // Sets user id.
    async setUser(user_id){
        this.config.user_id = user_id;
        return true;
    }

    // Creates new database/database handler.
    async newDatabase(options){
        if(options && typeof options === "object"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "DatabaseHandler", });

            if(!validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New database handler creation failed`) : false; }

            if(validateConfig.object.system == "mysql" || validateConfig.object.system == "postgres" || validateConfig.object.system == "mariadb"){
                this.database_handler = new FCMySQLHandler({ system: validateConfig.object.system, database: validateConfig.object.database, username: validateConfig.object.username, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, table_name: validateConfig.object.table_name, proper_delete: validateConfig.object.proper_delete, sequelize_instance: validateConfig.object.sequelize_instance, user_model: validateConfig.object.user_model, });
            }else{
                if(validateConfig.object.system == "mongodb"){
                    this.database_handler = new FCMongoDBHandler({ system: validateConfig.object.system, database: validateConfig.object.database, username: validateConfig.object.username, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, table_name: validateConfig.object.table_name, proper_delete: validateConfig.object.proper_delete, });
                }
            }

            if(validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New database handler created`) : false; return true; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_idbho"}).errorObj; }else{ return false; } }
    }

    // Creates new file protector.
    async newProtector(options){
        if(options && typeof options === "object"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "FileProtector", });

            if(!validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New file protector creation failed`) : false; return false; }

            this.file_protector = new FCFileProtector({ algorithm: validateConfig.object.algorithm,});

            if(validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New file protector created`) : false; return true; }
        }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "c_ifpo"}).errorObj; }else{ return false; } }
    }

    // Private function.
    // Creates new local directory.
    async makeLocalDir(path){
        if(!fs.existsSync(path)){
            const response = await fs.promises.mkdir(path, { recursive: true }).then(msg => {
                return true;
            }).catch(error => {
                return false;
            });

            return response;
        }

        return true;
    }

    // Private function.
    // Creates new local file.
    async makeLocalFile(path, data){
        const response = await fs.promises.writeFile(path, data).then(async msg => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    // Private function.
    // Gets size of a local file.
    async getLocalFileSize(path) {
        const response = await fs.promises.stat(path).then(data => {
            return data.size;
        }).catch(error => {
            return 0;
        });

        return response;
    }

    // Private function.
    // Checks if a local path exists.
    async doesLocalPathExists(path){
        return await fs.promises.access(path).then(data => {
            return true;
        }).catch(error => {
            return false;
        });
    }

    // Private function.
    // Checks if a local path is of a file.
    async isLocalPathOfFile(path){
        return await fs.promises.stat(path).then(data => {
            return data.isFile();
        }).catch(error => {
            return false;
        });
    }

    // Private function.
    // Checks if a local path is of a directory.
    async isLocalPathOfDirectory(path){
        return await fs.promises.stat(path).then(data => {
            return data.isDirectory();
        }).catch(error => {
            return false;
        });
    }

    // Private function.
    // Searches files in a local directory.
    async searchLocalFiles(dirPath, query){
        const isValid = await this.doesLocalPathExists(dirPath);
        if(isValid){
            const isDir = await this.isLocalPathOfDirectory(dirPath);
            if(isDir){
                const files = await fs.promises.readdir(dirPath).then(data => {
                    return data;
                }).catch(error => {
                    return [];
                });

                let filteredFiles = [];
                const querySplit = query ? query.toLowerCase().split(":") : [null, null];
                const queryType = querySplit[0];
                const queryParam = querySplit[1];

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

                let finalFiles = [];
                for(let file of filteredFiles){
                    const fileObj = await this.getLocalFile(dirPath+"/"+file); // Get data for each local file.
                    if(fileObj){
                        finalFiles.push(fileObj);
                    }
                }

                return finalFiles;
            }else{ return []; }
        }else{ return []; }
    }

    // Private function.
    // Returns values of a local file.
    async getLocalFile(fpath){
        const isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            const isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                const data = await this.getLocalFileData(fpath);
                const parsedPath = path.parse(fpath);
                const folderPath = parsedPath.dir.replace(this.config.base_path, "");
                const obj = { data: data, name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath == "" ? "/" : folderPath, };

                return obj;
            }else{ return null; }
        }else{ return null; }
    }

    // Private function.
    // Gets data of a local file.
    async getLocalFileData(path){
        const data = await fs.promises.readFile(path).then(async data => {
            return data;
        }).catch(error => {
            return null;
        });

        return data;
    }

    // Private function.
    // Deletes a local file.
    async deleteLocalFile(path){
        const response = fs.promises.rm(path).then(async (msg) => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    // Private function.
    // Renames a local file.
    async renameLocalFile(path, new_path){
        const response = fs.promises.rename(path, new_path).then(async (msg) => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    // Private function.
    // Returns a new FCFile instance.
    async newFCFile(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "File", });

        if(validateConfig.success){
            let newFile = new FCFile(options);
            await newFile.init();
            Config.debug ? console.log("New FCFile created") : false;

            return newFile;
        }else{ Config.debug ? console.log("New FCFile creation failed") : false; return null; }

        return null;
    }

    // Private function.
    // Returns files from a multipart http request using multiparty.
    async getFilesFromHttpRequest(request){
        if(request){
            try{
                const form = new multiparty.Form();
                const files = await new Promise(function(resolve, reject){
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

    // Private function.
    // Gets paths of all files in a local directory.
    async getAllFilesOfLocalDirectory(path){
        const items = await fs.promises.readdir(path).then(async data => {
            let files = [];
            for(let item of data){
                const isItemDir = await fs.promises.stat(`${path}/${item}`).then(stats => {return stats.isDirectory()}).catch(error => {return false;});
                if(isItemDir){
                    const filesOfCurrentDir = await this.getAllFilesOfLocalDirectory(`${path}/${item}`, null);
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

    // Private function.
    // Replaces data of a local file.
    async replaceLocalFileData(fpath, data){
        const isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            const isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                return await fs.promises.writeFile(fpath, data).then(message => {
                    return true;
                }).catch(error => {
                    return false;
                });
            }
        }

        return false;
    }
}

module.exports = FCFileHandler;
