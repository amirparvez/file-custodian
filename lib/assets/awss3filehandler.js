import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

class FCAWSS3FileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);
    }

    async newFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "S3File_Creation", });

        if(validateConfig.success){
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

                        let newS3FileCreated = await this.makeS3File(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${requestFileName}`, finalContents, doEncrypt, isStream);
                        if(newS3FileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                            Config.debug ? console.log("New S3file created") : false;
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }else{ }
                }

                return FCFiles.length > 0 ? FCFiles : null;
            }else{
                const fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", validateConfig.object.ext.toString().toLowerCase());

                let finalContents = validateConfig.object.contents;
                let doEncrypt = false;
                let didEncrypt = false;
                if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                    // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                    doEncrypt = true;
                    // Encrypt contents while writing the file.
                }

                let newS3FileCreated = await this.makeS3File(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, finalContents, doEncrypt, validateConfig.object.isStream);
                if(newS3FileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                    Config.debug ? console.log("New S3file created", newFCFile) : false;
                    return newFCFile;
                }

                Config.debug ? console.log("New S3file creation failed") : false;
                return null;
            }
        }else{ Config.debug ? console.log("New S3file creation failed") : false; }
    }

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

            let response = await this.deleteS3File(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`);
            if(response){ Config.debug ? console.log("S3file deleted") : false; return true; }

            Config.debug ? console.log("S3file deletion failed") : false; return false;
        }else{ Config.debug ? console.log("S3file deletion failed") : false; return false; }
    }

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

            let response = await this.renameS3File(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`, `${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${newPath}`);
            if(response){ Config.debug ? console.log("S3file renamed") : false; return true; }

            Config.debug ? console.log("S3file renaming failed") : false; return false;
        }else{ Config.debug ? console.log("S3file renaming failed") : false; return false; }
    }

    async getFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let file = await this.getS3File(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`);
            if(file){ return await self.newFCFile({...file, handler: self, isEncrypted: false,}); }
        }

        return null;
    }

    async getFileSize(path){
        return await this.getS3FileSize(path);
    }

    async searchFiles(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.folder;

            let files = await this.searchS3Files(`${self.config.base_path}${self.config.base_path === "" ? "" : "/"}${pathToFile}`, validateConfig.object.query);
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

    async syncDatabase(){
        try{
            let files = await this.getAllFilesOfS3Directory(this.config.base_path);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let data = await this.getS3File(file.Key);
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
}

module.exports = FCAWSS3FileHandler;
