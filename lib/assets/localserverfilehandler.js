import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

const fs = require("fs");

class FCLocalServerFileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);
    }

    // Creates new file/s in depository.
    async newFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "LSFile_Creation", });

        if(validateConfig.success){
            if(validateConfig.object.folder !== ""){
                await this.makeLocalDir(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${validateConfig.object.folder.replace("FILE_EXTENSION_WISE", "")}`);
            }

            if(validateConfig.object.request){
                // If an Http request is provided.
                let requestFiles = await this.getFilesFromHttpRequest(validateConfig.object.request);
                let FCFiles = [];

                for(let requestFile of requestFiles){
                    let { contents, contentType, readStream } = await this.getLocalFileContents(requestFile.path, false); // contents & readStream are same since 2nd parameter, decrypt, is false. If decrypt is true, contents is a pipeline.
                    let isStream = true;
                    let doEncrypt = false;
                    let didEncrypt = false;

                    if(contents){
                        let finalContents = contents;
                        if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                            // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                            doEncrypt = true;
                            // Encrypt contents while writing the file.
                        }

                        let requestFileName = requestFile.originalFilename;
                        let ext_regex = /(?:\.([^.]+))?$/;
                        let requestFileExt = ext_regex.exec(requestFileName)[1];
                        let fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());

                        await this.makeLocalDir(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}`);

                        let newLocalFileCreated = await this.makeLocalFile(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${requestFileName}`, finalContents, doEncrypt, isStream);
                        if(newLocalFileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                            Config.debug ? console.log("New LSfile created") : false;
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }else{ }
                }

                return FCFiles.length > 0 ? FCFiles : null;
            }else{
                const fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", validateConfig.object.ext.toString().toLowerCase());

                await this.makeLocalDir(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}`);

                let finalContents = validateConfig.object.contents;
                let doEncrypt = false;
                let didEncrypt = false;
                if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                    // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                    doEncrypt = true;
                    // Encrypt contents while writing the file.
                }

                let newLocalFileCreated = await this.makeLocalFile(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, finalContents, doEncrypt, validateConfig.object.isStream);
                if(newLocalFileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                    Config.debug ? console.log("New LSfile created", newFCFile) : false;
                    return newFCFile;
                }

                Config.debug ? console.log("New LSfile creation failed") : false;
                return null;
            }
        }else{ Config.debug ? console.log("New LSfile creation failed") : false; }
    }

    // Deletes a file from depository.
    async deleteFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null){
                return false;
            }

            let response = await this.deleteLocalFile(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`);
            if(response){ Config.debug ? console.log("LSfile deleted") : false; return true; }

            Config.debug ? console.log("LSfile deletion failed") : false; return false;
        }else{ Config.debug ? console.log("LSfile deletion failed") : false; return false; }
    }

    // Renames a file in depository.
    async renameFile(options){
        // Options can be either of these:
        // 1. old path & new path.
        // 2. name, ext, folder & new path.
        // 3. name, ext, folder & new name.

        // Options not allowed: old path & new name.

        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_RenameFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let newPath = validateConfig.object.new_path ? validateConfig.object.new_path : (
                validateConfig.object.new_name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.new_name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return false;
            }

            let response = await this.renameLocalFile(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`, `${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${newPath}`);
            if(response){ Config.debug ? console.log("LSfile renamed") : false; return true; }

            Config.debug ? console.log("LSfile renaming failed") : false; return false;
        }else{ Config.debug ? console.log("LSfile renaming failed") : false; return false; }
    }

    // Gets a file from depository.
    async getFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let file = await this.getLocalFile(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`);
            if(file){ return await self.newFCFile({...file, handler: self, isEncrypted: false,}); }
        }

        return null;
    }

    // Searches file in depository.
    async searchFiles(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.folder;

            let files = await this.searchLocalFiles(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`, validateConfig.object.query);
            if(files){
                let FCFiles = [];
                for(let file of files){
                    FCFiles.push(await self.newFCFile({...file, handler: self, isEncrypted: false,})); // Wrap file values in a FCFile instance. isEncrypted is not true because verification of contents is handled at FCFile's init() function.
                }

                return FCFiles;
            }
        }

        return [];
    }

    // Private function.
    // Gets size of file in depository.
    async getFileSize(path){
        return await this.getLocalFileSize(path);
    }

    // Syncs all files in the depository to the connected database.
    async syncDatabase(){
        try{
            let files = await this.getAllFilesOfLocalDirectory(this.config.base_path);
            console.log(files);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let data = await this.getLocalFile(file);
                    let FCFile = await this.newFCFile({...data, handler: this, isEncrypted: false,}); // Wrap file values in a FCFile instance.
                    let FCFileWithModelData = await FCFile.record(); // Create a file entry in database if it does not exists.
                    FCFileWithModelData ? filesWithInformation.push(FCFileWithModelData) : false;
                }catch(error){continue;}
            }

            return filesWithInformation;
        }catch(error){
            return [];
        }
    }

    // Replaces file contents in depository.
    async replaceFileContents(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_ReplaceFileContents", });
        try{
            if(validateConfig.success){
                let beautifiedPath = await validateConfig.object.file.beautifyPath(validateConfig.object.file.config.folder);
                let filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${validateConfig.object.file.config.name}.${validateConfig.object.file.config.ext}`;

                return await this.makeLocalFile(`${this.config.base_path}${self.config.base_path === "" ? "" : "/"}${filePath}`, validateConfig.object.new_contents, validateConfig.object.doEncrypt, validateConfig.object.isStream);
            }else{ return false; }
        }catch(error){
            return false;
        }
    }

    // Private function.
    // Returns contents of a file in depository.
    async getFileContents(file){
        try{
            let beautifiedPath = await file.beautifyPath(file.config.folder);
            let filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${file.config.name}.${file.config.ext}`;

            return await this.getLocalFileContents(`${this.config.base_path}${self.config.base_path === "" ? "" : "/"}${filePath}`, file.config.isEncrypted);
        }catch(error){
            return { contents: null, contentType: null, readStream: null,  };
        }
    }
}

module.exports = FCLocalServerFileHandler;
