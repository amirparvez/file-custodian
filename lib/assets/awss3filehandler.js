import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

const aws = require('aws-sdk');
const fs = require("fs");
const path = require('path');
const stream = require('stream');
const crypto = require('crypto');

const util = require('util');
const pipelineWithoutPromise = stream.pipeline;

class FCAWSS3FileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);

        this.config = {
            ...this.config,
            bucketName: null,
            bucketRegion: null,
            keyId: null,
            key: null,
            s3: null,
        }
    }

    // Creates new file/s in depository.
    async newFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "S3File_Creation", });

        if(validateConfig.success){
            if(validateConfig.object.request){
                // If an Http request is provided.
                let requestFiles = await this.getFilesFromHttpRequest(validateConfig.object.request);
                let FCFiles = [];

                for(let requestFile of requestFiles){
                    let { contents, contentType, contentLength, readStream } = await this.getLocalFileContents(requestFile.path, false, null); // contents & readStream are same since 2nd parameter, decrypt, is false. If decrypt is true, contents is a pipeline.
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

                        let newS3FileCreated = await this.makeS3File(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
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

                let newS3FileCreated = await this.makeS3File(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, finalContents, validateConfig.object.isStream === true ? finalContents : null, doEncrypt, validateConfig.object.isStream, validate.object.contentLength, false);
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

            let response = await this.deleteS3File(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
            if(response){ Config.debug ? console.log("S3file deleted") : false; return true; }

            Config.debug ? console.log("S3file deletion failed") : false; return false;
        }else{ Config.debug ? console.log("S3file deletion failed") : false; return false; }
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

            let newPath = validateConfig.object.newPath ? validateConfig.object.newPath : (
                validateConfig.object.newName && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.newName}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return false;
            }

            let response = await this.renameS3File(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`, `${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${newPath}`);
            if(response){ Config.debug ? console.log("S3file renamed") : false; return true; }

            Config.debug ? console.log("S3file renaming failed") : false; return false;
        }else{ Config.debug ? console.log("S3file renaming failed") : false; return false; }
    }

    // Gets a file from depository.
    async getFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let file = await this.getS3File(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
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

            let files = await this.searchS3Files(pathToFile.toString().trim() === "*" ? "*" : `${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`, validateConfig.object.query, validateConfig.object.forceRequestToS3);
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
        return await this.getS3FileSize(path);
    }

    // Syncs all files in the depository to the connected database.
    async syncDatabase(){
        try{
            let files = await this.getAllFilesOfS3Directory("*", true);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let data = await this.getS3File(file.path);
                    let FCFile = await this.newFCFile({...data, handler: this, isEncrypted: false,}); // Wrap file values in a FCFile instance.
                    FCFile ? await FCFile.record() : false; // Create a file entry in database if it does not exists.
                    FCFile ? filesWithInformation.push(FCFile) : false;
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

                return await this.makeS3File(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
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

            return await this.getS3FileContents(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, file.config.isEncrypted, file.config.iv);
        }catch(error){
            return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
        }
    }

    /* Core/Helping/Util functions */

    async setupS3(){
        try{
            this.config.s3 = new aws.S3({
                accessKeyId: this.config.keyId,
                secretAccessKey: this.config.key,
            });
        }catch(error){
            Config.debug ? console.log(error) : false;
            this.config.s3 = null;
            return false;
        }

        return await this.makeS3Bucket(this.config.basePath);
    }

    // Private function.
    // Creates new s3 bucket.
    async makeS3Bucket(){
        try{
            await this.config.s3.createBucket({ Bucket: this.config.bucketName, CreateBucketConfiguration: { LocationConstraint: this.config.bucketRegion }, }).promise();
            return true;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Creates new s3 file.
    async makeS3File(path, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing must be true when reading and writing from and to the same file.
        const self = this;
        const contentType = await this.getContentType(path);

        try{
            var contentStream = contents;
            if(isStream === false){ contentStream = stream.Readable.from(contents.toString(), { highWaterMark: self.config.encryptingSpeed, }); }

            contentStream.pause();
            contentStream.on('end', function(){ contentStream.destroy(); });
            contentStream.on('error', function(error){ contentStream.destroy(); });

            if(doEncrypt === true){
                let uniqueIV = crypto.randomBytes(16).toString('hex');
                const encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength, uniqueIV);
                const pipeline = pipelineWithoutPromise(contentStream, encryptStream, (error) => { });
                contentStream.push(Buffer.from(`(${uniqueIV})`));
                return await this.config.s3.upload({
                    Bucket: this.config.bucketName,
                    Key: path,
                    Body: pipeline,
                    ContentType: contentType,
                    ACL: 'public-read'
                }).promise().then(message => { return true; }).catch(error => { Config.debug ? console.log(error) : false; return false; });
            }else{
                if(isReplacing){
                    // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                    // contentStream is a pipeline passed from getS3FileContents()
                    readStream.resume();
                    return await this.config.s3.upload({
                        Bucket: this.config.bucketName,
                        Key: path,
                        Body: contentStream,
                        ContentType: contentType,
                        ACL: 'public-read'
                    }).promise().then(message => { return true; }).catch(error => { Config.debug ? console.log(error) : false; return false; });
                }else{
                    // contentStream is a read stream
                    contentStream.resume();
                    return await this.config.s3.upload({
                        Bucket: this.config.bucketName,
                        Key: path,
                        Body: contentStream,
                        ContentType: contentType,
                        ACL: 'public-read'
                    }).promise().then(message => { return true; }).catch(error => { Config.debug ? console.log(error) : false; return false; });
                }
            }

            return true;
        }catch(error){ Config.debug ? console.log(error) : false; return false; }
        return false;
    }

    // Private function.
    // Gets size of a s3 file.
    async getS3FileSize(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, return size from the database.
                const model = await this.database_handler.getModel({ path: path, userId: this.config.userId, });
                if(model){ return model.size; }
            }

            // If database is not connected, make a request to s3.
            const headers = await this.config.s3.headObject({ Key: path, Bucket: this.config.bucketName }).promise();
            return headers.ContentLength !== null ? headers.ContentLength : 0;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return 0;
    }

    // Private function.
    // Checks if a s3 path exists.
    async doesS3PathExists(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, check path existence from the database.
                const model = await this.database_handler.getModel({ path: path, userId: this.config.userId, });
                if(model){ return true; }
            }

            // If database is not connected, make a request to s3.
            return this.config.s3.headObject({ Key: path, Bucket: this.config.bucketName }).promise().then(headers => {
                return true;
            }).catch(error => {
                Config.debug ? console.log(error) : false;
                return false;
            });
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Searches files in a s3 directory.
    async searchS3Files(dirPath, query, forceRequestToS3 = false){
        try{
            var files = [];
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: dirPath, userId: this.config.userId, });
                if(Array.isArray(models)){ files = models; }
            }else{
                // If database is not connected, make a request to s3.
                files = await this.getAllFilesOfS3Directory(dirPath, forceRequestToS3);
            }

            let filteredFiles = [];
            const querySplit = query ? query.toLowerCase().split(":") : [null, null];
            const queryType = querySplit[0];
            const queryParam = querySplit[1];

            if(query !== null && typeof query === "string"){
                if(queryType === "extension"){
                    filteredFiles = files.filter(file => {
                        return path.extname(file.path).replace(".", "").toLowerCase() === queryParam;
                    });
                }else{
                    if(queryType === "name"){
                        filteredFiles = files.filter(file => {
                            return file.path.replace(path.extname(file.path), "").toLowerCase() === queryParam;
                        });
                    }else{
                        if(queryType === "name_contains"){
                            filteredFiles = files.filter(file => {
                                return file.path.replace(path.extname(file.path), "").toLowerCase().includes(queryParam);
                            });
                        }else{ filteredFiles = files; }
                    }
                }
            }else{ filteredFiles = files; }

            let finalFiles = [];
            for(let file of filteredFiles){
                const fileObj = await this.getS3File(file.path); // Get data for each s3 file.
                if(fileObj){
                    finalFiles.push(fileObj);
                }
            }

            return finalFiles;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return [];
    }

    // Private function.
    // Returns values of a s3 file.
    async getS3File(fpath){
        try{
            const isValid = await this.doesS3PathExists(fpath, false);
            if(isValid){
                if(this.database_handler !== null){
                    const model = await this.database_handler.getModel({ path: fpath, userId: this.config.userId, });
                    if(model){
                        const obj = { name: model.name, ext: model.extension, folder: model.folder, };
                        return obj;
                    }
                }

                const parsedPath = path.parse(fpath);
                const folderPath = parsedPath.dir.replace(this.config.basePath, ""); // Remove basePath
                if(folderPath.charAt(0) === "/"){ folderPath = folderPath.substring(1); } // Remove forward slash
                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };
                return obj;
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return null;
    }

    // Private function.
    // Gets contents of a s3 file.
    async getS3FileContents(path, doDecrypt, uniqueIV){
        const self = this;
        const isValid = await self.doesS3PathExists(path, true);
        if(isValid){
            const contentType = await self.getContentType(path);

            try{
                const readStream = self.config.s3.getObject({ Bucket: self.config.bucketName, Key: path, }).createReadStream();
                readStream.pause();
                //readStream.on('end', function(){ readStream.destroy(); }); // Destroying stream on end might sometimes cause troubles encrypting-decrypting the last chunk.
                readStream.on('error', function(error){ readStream.destroy(); });

                const speed = self.config.encryptingSpeed;
                const contentLength = await self.getS3FileSize(path, true);

                if(doDecrypt === true && self.file_protector !== null){
                    const decryptStream = self.createDecryptStream(speed, readStream, contentLength, uniqueIV);
                    const pipeline = pipelineWithoutPromise(readStream, decryptStream, (error) => { });
                    readStream.pause();

                    return { contents: pipeline, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                }else{
                    return { contents: readStream, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                }
            }catch(error){ return { contents: null, contentType: null, contentLength: 0, readStream: null, }; }
        }

        return { contents: null, contentType: null, contentLength: 0, readStream: null, };
    }

    // Private function.
    // Deletes a s3 file.
    async deleteS3File(path){
        try{
            return this.config.s3.deleteObject({ Bucket: this.config.bucketName, Key: path }).promise().then(message => {
                return true;
            }).catch(error => {
                Config.debug ? console.log(error) : false;
                return false;
            })
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Renames an s3 file.
    async renameS3File(path, newPath){
        const self = this;
        try{
            return self.config.s3.copyObject({ Bucket: self.config.bucketName, CopySource: `${self.config.bucketName}/${path}`, Key: newPath, }).promise().then(() => {
                try{ return self.config.s3.deleteObject({ Bucket: self.config.bucketName, Key: path, }).promise().then(message => { return true; }).catch(message => { return false; }); }
                catch(error){ Config.debug ? console.log(error) : false; return false; }
            }).catch((error) => { Config.debug ? console.log(error) : false; return false; })
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Gets all files of an s3 directory. When * supplied as folder, get files of the entire bucket.
    async getAllFilesOfS3Directory(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: path, userId: this.config.userId, });
                if(Array.isArray(models)){ return models; }
            }else{
                // If database is not connected, make a request to s3.
                var options = { Bucket: this.config.bucketName, };
                if(path.toString().trim() !== "*"){ options = {...options, Delimiter: '/', Prefix: path+(path === "" ? "" : "/"),}; }

                return await this.config.s3.listObjects(options).promise().then(data => {
                    return data.Contents.map(x => ({...x, path: x.Key}));;
                }).catch(error => {
                    Config.debug ? console.log(error) : false;
                    return [];
                });
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return [];
    };

    // Private function.
    // Reads file to get it's unique encryption initialization vector stored with it in format of: (iv) in first 34 bytes.
    async readFileIV(path){
        let self = this;
        const isValid = await this.doesS3PathExists(path);
        if(isValid){
            let contents = await self.config.s3.getObject({ Bucket: self.config.bucketName, Key: path, Range: 'bytes=0-34' }).promise().then(data => {return data;}).catch(error => { Config.debug ? console.log(error) : false; return null; });

            if(!contents){ return null; }
            if(!contents.Body){ return null; }
            if(contents.Body.length === 0){ return null; }

            let readable = await contents.Body.toString();
            let regex = /\(([^)]+)\)/;
            let match = readable.match(regex);

            if(!match){ return null; }
            if(match.length < 1){ return null; }
            if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'

            return match[1];
        }

        return null;
    }
}

module.exports = FCAWSS3FileHandler;
