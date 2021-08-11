import Logger from '../misc/logger.js';
import ObjectValidator from '../misc/objectvalidator.js';
import FileHandler from '../filehandler.js';

import aws from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import crypto from 'crypto';
import util from 'util';

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
        const fsn = await this.getFileSchemaNameFromFH();
        const validateConfig = await ObjectValidator.validate({ object: options, against: "File_Creation", });

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
                        let folderPath = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());
                        let fullFolderPath = await this.beautifyPath(folderPath, true);

                        let newS3FileCreated = await this.makeS3File(`${fullFolderPath}${fullFolderPath == "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
                        if(newS3FileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                            Logger.log(`New ${fsn} created`);
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }
                }

                return FCFiles.length > 0 ? FCFiles : null;
            }else{
                let folderPath = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", validateConfig.object.ext.toString().toLowerCase());
                let fullFolderPath = await this.beautifyPath(folderPath, true);

                let finalContents = validateConfig.object.contents;
                let doEncrypt = false;
                let didEncrypt = false;
                if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                    // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                    doEncrypt = true;
                    // Encrypt contents while writing the file.
                }

                let newS3FileCreated = await this.makeS3File(
                    `${fullFolderPath}${fullFolderPath == "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`,
                    finalContents,
                    validateConfig.object.isStream === true ? finalContents : null,
                    doEncrypt,
                    validateConfig.object.isStream,
                    validateConfig.object.isStream === true ? validateConfig.object.contentLength : finalContents.length,
                    false
                );

                if(newS3FileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                    Logger.log(`New ${fsn} created`, newFCFile);
                    return newFCFile;
                }

                Logger.log(`New ${fsn} creation failed`);
            }
        }else{ Logger.log(`New ${fsn} creation failed`); }

        return null;
    }

    // Deletes a file from depository.
    async deleteFile(options){
        const self = this;
        const fsn = await this.getFileSchemaNameFromFH();
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_DeleteFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null){
                return false;
            }

            pathToFile = await this.beautifyPath(pathToFile, true);

            let response = await this.deleteS3File(pathToFile, []);
            if(response){ Logger.log(`${fsn} deleted`); return true; }

            Logger.log(`${fsn} deletion failed`);
        }else{ Logger.log(`${fsn} deletion failed`); }

        return false;
    }

    // Renames a file in depository.
    async renameFile(options){
        // Options can be either of these:
        // 1. old path & new path.
        // 2. name, ext, folder & new path.
        // 3. name, ext, folder & new name.

        // Options not allowed: old path & new name.

        const self = this;
        const fsn = await this.getFileSchemaNameFromFH();
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

            pathToFile = await this.beautifyPath(pathToFile, true);
            newPath = await this.beautifyPath(newPath, true);

            let response = await this.renameS3File(pathToFile, newPath);
            if(response){ Logger.log(`${fsn} renamed`); return true; }

            Logger.log(`${fsn} renaming failed`);
        }else{ Logger.log(`${fsn} renaming failed`); }

        return false;
    }

    // Gets a file from depository.
    async getFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let fullPathToFile = await this.beautifyPath(pathToFile, true);

            let file = await this.getS3File(fullPathToFile);
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

            let files = await this.searchS3Files(pathToFile.toString().trim() === "*" ? "*" : await this.beautifyPath(pathToFile, true), validateConfig.object.query, validateConfig.object.forceRequestToProvider);
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
    async getFileSize(path, forceRequestToProvider = true){
        return await this.getS3FileSize(path, forceRequestToProvider);
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
                    FCFile ? await FCFile.record(false) : false; // Create a file entry in database if it does not exists.
                    FCFile ? filesWithInformation.push(FCFile) : false;
                }catch(error){continue;}
            }

            return filesWithInformation;
        }catch(error){ Logger.log(error); }

        return [];
    }

    // Replaces file contents in depository.
    async replaceFileContents(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_ReplaceFileContents", });
        try{
            if(validateConfig.success){
                let beautifiedPath = await this.beautifyPath(validateConfig.object.file.config.folder, true);
                let filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${validateConfig.object.file.config.name}.${validateConfig.object.file.config.ext}`;

                return await this.makeS3File(filePath, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
            }
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Returns contents of a file in depository.
    async getFileContents(file, returnDecryptStreamSeparately = false){
        try{
            let beautifiedPath = await this.beautifyPath(file.config.folder, true);
            let filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${file.config.name}.${file.config.ext}`;

            return await this.getS3FileContents(filePath, file.config.isEncrypted, file.config.iv);
        }catch(error){ Logger.log(error); }

        return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
    }

    /* Core/Helping/Util functions */

    async setup(){
        try{
            if(this.config.type === "do-spaces" || this.config.type === "bb-b2"){
                this.config.s3 = new aws.S3({
                    endpoint: new aws.Endpoint(this.config.endpoint),
                    accessKeyId: this.config.keyId,
                    secretAccessKey: this.config.key,
                });
            }else{
                this.config.s3 = new aws.S3({
                    accessKeyId: this.config.keyId,
                    secretAccessKey: this.config.key,
                });
            }
        }catch(error){ Logger.log(error); this.config.s3 = null; return false; }

        if(this.config.s3){ return this.config.type === "bb-b2" ? true : await this.makeS3Bucket(); }
        return true;
    }

    // Private function.
    // Creates new s3 bucket.
    async makeS3Bucket(){
        try{
            let options = { Bucket: this.config.bucketName };

            if(this.config.type === "aws-s3"){
                options = {...options, CreateBucketConfiguration: { LocationConstraint: this.config.bucketRegion }};
            }

            await this.config.s3.createBucket(options).promise();
            return true;
        }catch(error){ Logger.log(error); return true; /*Bucket already owned.*/ }

        return false;
    }

    // Private function.
    // Creates new s3 file.
    async makeS3File(path, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing must be true when reading and writing from and to the same file.
        // readStream is null when isStream is false.

        const self = this;
        const contentType = await this.getContentType(path);

        try{
            const oldFileVersionsOfSameName = self.config.type == "bb-b2" ? await self.getS3FileVersions(path) : [];
            let didMake = false;

            var contentStream = contents;
            const uniqueIV = crypto.randomBytes(16).toString('hex');

            if(isStream === false){
                const readData = doEncrypt === true ? Buffer.concat([Buffer.from(`(${uniqueIV})`), Buffer.isBuffer(contents) ? contents : Buffer.from(contents)]) : Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
                contentStream = self.createDataReadStream(readData, self.config.encryptingSpeed);
            }

            contentStream.pause();
            contentStream.on('end', function(){ contentStream.destroy(); });
            contentStream.on('error', function(error){ contentStream.destroy(); });

            if(doEncrypt === true){
                // This condition is true, when making a new encrypted file or when replacing contents of a decrypted file with encrypted ones.

                // WHEN contents IS A STREAM (isStream === true) contentLength does not needs to be increased for encryptStream by 34 for IV since uniqueIV is not pushed into contentStream instead it's pushed into helperStream since contentStream.push will not prepend but append the IV...
                // ...therefore it will not be processed in the encryptStream, due to which encrypt stream will only need to the length of contents without IV length.
                const encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength+(isStream === true ? 0 : 34), uniqueIV);
                const helperStream = new stream.Transform({ readableHighWaterMark: self.config.encryptingSpeed, writeableHighWaterMark: self.config.encryptingSpeed, decodeStrings: false });
                helperStream._transform = function(chunk, encoding, callback){ this.push(chunk); callback(); };

                const pipeline = pipelineWithoutPromise(contentStream, encryptStream, helperStream, (error) => { Logger.log(error); });

                if(isStream === true){
                    // If contents is a stream, contentStream is set to contents and a manual creation of contentStream is not done therefore it is required to pass the uniqueIV.
                    helperStream.push(Buffer.from(`(${uniqueIV})`));
                }

                didMake = await this.config.s3.upload({
                    Bucket: this.config.bucketName,
                    Key: path,
                    Body: pipeline,
                    ContentType: contentType,
                    ACL: 'public-read'
                }).promise().then(message => { return true; }).catch(error => { Logger.log(error); return false; });
            }else{
                if(isReplacing === true){
                    // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                    // contentStream is a pipeline passed from getS3FileContents()
                    // isStream is TRUE
                    readStream.resume();
                    didMake = await this.config.s3.upload({
                        Bucket: this.config.bucketName,
                        Key: path,
                        Body: contentStream,
                        ContentType: contentType,
                        ACL: 'public-read'
                    }).promise().then(message => { return true; }).catch(error => { Logger.log(error); return false; });
                }else{
                    // contentStream is a read stream
                    contentStream.resume();
                    didMake = await this.config.s3.upload({
                        Bucket: this.config.bucketName,
                        Key: path,
                        Body: contentStream,
                        ContentType: contentType,
                        ACL: 'public-read'
                    }).promise().then(message => { return true; }).catch(error => { Logger.log(error); return false; });
                }
            }

            if(self.config.type == "bb-b2"){
                // If Backblaze B2, Delete the old version of same name if it exists
                try{
                    if(Array.isArray(oldFileVersionsOfSameName) && oldFileVersionsOfSameName.length > 0 && didMake === true){
                        await self.deleteS3File(path, oldFileVersionsOfSameName);
                    }
                }catch(error){ Logger.log(error); }
            }

            return true;
        }catch(error){ Logger.log(error); }
        return false;
    }

    // Private function.
    // Gets size of a s3 file.
    async getS3FileSize(path, forceRequestToProvider = false){
        try{
            if(this.database_handler !== null && forceRequestToProvider === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, return size from the database.
                const model = await this.database_handler.getModel({ path: path, userId: this.config.userId, });
                if(model){ return model.size; }
            }

            // If database is not connected, make a request to s3.
            const headers = await this.config.s3.headObject({ Key: path, Bucket: this.config.bucketName }).promise();
            return headers.ContentLength !== null ? headers.ContentLength : 0;
        }catch(error){ Logger.log(error); }

        return 0;
    }

    // Private function.
    // Checks if a s3 path exists.
    async doesS3PathExists(path, forceRequestToProvider = false){
        try{
            if(this.database_handler !== null && forceRequestToProvider === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, check path existence from the database.
                const model = await this.database_handler.getModel({ path: path, userId: this.config.userId, });
                if(model){ return true; }
            }

            // If database is not connected, make a request to s3.
            return this.config.s3.headObject({ Key: path, Bucket: this.config.bucketName }).promise().then(headers => {
                return true;
            }).catch(error => {
                Logger.log(error);
                return false;
            });
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Searches files in a s3 directory.
    async searchS3Files(dirPath, query, forceRequestToProvider = false){
        try{
            var files = [];
            if(this.database_handler !== null && forceRequestToProvider === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: dirPath, userId: this.config.userId, });
                if(Array.isArray(models)){ files = models; }
            }else{
                // If database is not connected, make a request to s3.
                files = await this.getAllFilesOfS3Directory(dirPath, forceRequestToProvider);
            }

            let filteredFiles = [];
            const querySplit = query ? query.toLowerCase().split(":") : [null, null];
            const queryType = querySplit[0];
            const queryParam = querySplit[1];

            if(query !== null && typeof query === "string"){
                if(queryType === "extension"){
                    filteredFiles = files.filter(file => {
                        return path.extname(file.path).replace(".", "").toLowerCase() == queryParam;
                    });
                }else{
                    if(queryType === "name"){
                        filteredFiles = files.filter(file => {
                            return path.basename(file.path).replace(path.extname(file.path), "").toLowerCase() == queryParam;
                        });
                    }else{
                        if(queryType === "name_contains"){
                            filteredFiles = files.filter(file => {
                                return path.basename(file.path).replace(path.extname(file.path), "").toLowerCase().includes(queryParam);
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
        }catch(error){ Logger.log(error); }

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
                let folderPath = this.config.basePath == "" ? parsedPath.dir : parsedPath.dir.replace(this.config.basePath+"/", ""); // Remove basePath
                if(folderPath.charAt(0) === "/"){ folderPath = folderPath.substring(1); } // Remove forward slash

                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };
                return obj;
            }
        }catch(error){ Logger.log(error); }

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
            }catch(error){ Logger.log(error); }
        }

        return { contents: null, contentType: null, contentLength: 0, readStream: null, };
    }

    async getS3FileVersions(path){
        try{
            if(path.charAt(0) == '/'){ path = path.substring(1); } // Remove first slash
            return await this.config.s3.listObjectVersions({ Bucket: this.config.bucketName, Prefix: path }).promise().then(data => {
                return data && data.Versions && Array.isArray(data.Versions) ? data.Versions : [];
            }).catch(error => {
                Logger.log(error);
                return [];
            })
        }catch(error){ Logger.log(error); }

        return [];
    }

    // Private function.
    // Deletes a s3 file.
    async deleteS3File(path, versionsToDelete = []){
        try{
            var versions = [];
            if(Array.isArray(versionsToDelete) && versionsToDelete.length > 0){
                versions = versionsToDelete;
            }else{
                versions = await this.getS3FileVersions(path);
            }

            for(let version of versions){
                try{
                    let deleted = await this.config.s3.deleteObject({ Bucket: this.config.bucketName, Key: path, VersionId: version.VersionId, }).promise().then(message => {
                        return true;
                    }).catch(error => {
                        Logger.log(error);
                        return false;
                    });
                }catch(error){ Logger.log(error); }
            }

            return true;
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Renames an s3 file.
    async renameS3File(fpath, newPath){
        const self = this;
        try{
            return await self.config.s3.copyObject({ Bucket: self.config.bucketName, CopySource: `${self.config.bucketName}/${fpath}`, Key: newPath, }).promise().then(async () => {
                try{
                    return await self.deleteS3File(fpath, []);
                }catch(error){ Logger.log(error); return false; }
            }).catch((error) => { Logger.log(error); return false; })
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Gets all files of an s3 directory. When * supplied as path, get files of the entire bucket.
    async getAllFilesOfS3Directory(path, forceRequestToProvider = false){
        const self = this;
        try{
            if(self.database_handler !== null && forceRequestToProvider === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await self.database_handler.getAllModels({ folder: path, userId: self.config.userId, });
                if(Array.isArray(models)){ return models; }
            }else{
                // If database is not connected, make a request to s3.
                var options = { Bucket: self.config.bucketName, };

                if(path.charAt(0) == '/'){ path = path.substring(1); } // Remove first slash
                if(path.toString().trim() !== "*"){ options = { ...options, Delimiter: '/', Prefix: path+(path === "" ? "" : "/"), }; } // Prefix needs an ending slash

                return await self.config.s3.listObjects(options).promise().then(data => {
                    return data.Contents.map(x => ({...x, path: x.Key })); // x.Key does not needs to be checked for basePath since it's already handled in getS3File
                }).catch(error => {
                    Logger.log(error);
                    return [];
                });
            }
        }catch(error){ Logger.log(error); }

        return [];
    };

    // Private function.
    // Reads file to get it's unique encryption initialization vector stored with it in format of: (iv) in first 34 bytes.
    async readFileIV(path){
        let self = this;
        const isValid = await this.doesS3PathExists(path);
        if(isValid){
            let contents = await self.config.s3.getObject({ Bucket: self.config.bucketName, Key: path, Range: 'bytes=0-34' }).promise().then(data => {return data;}).catch(error => { Logger.log(error); return null; });

            if(!contents){ return null; }
            if(!contents.Body){ return null; }
            if(contents.Body.length === 0){ return null; }

            let readable = await contents.Body.toString();
            let regex = /\(([^)]+)\)/;
            let match = readable.match(regex);

            if(!match){ return null; }
            if(match.length < 1){ return null; }
            if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'. < 32 for match

            return match[1];
        }

        return null;
    }
}

export default FCAWSS3FileHandler;
