import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCMongoDBHandler from './mongodbhandler';
import FCMySQLHandler from './mysqlhandler';
import FCFile from './file';
import FCFileProtector from './fileprotector';

const aws = require('aws-sdk');
const fs = require("fs");
const path = require('path');
const multiparty = require('multiparty');
const stream = require('stream');
const util = require('util');
const pipelineWithoutPromise = stream.pipeline;
const pipelineWithPromise = util.promisify(stream.pipeline);
const mime = require('mime-types');

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            type: null,
            base_path: null,
            user_id: null,
            bucket_name: null,
            bucket_region: null,
            key_id: null,
            key: null,
            s3: null,
            readingSpeed: 16384,
            writingSpeed: 16384,
            encryptingSpeed: 16384,
        };

        this.database_handler = null; // File handler can have one database handler.
        this.file_protector = null; // File handler can have one file protector.

        this.init();
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.type == "local-server"){ await this.setupLocal(); }else{
                if(this.config.type == "aws-s3"){ await this.setupS3(); }
            }

            console.log(this);

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    async setupLocal(){
        return await this.makeLocalDir(this.config.base_path);
    }

    async setupS3(){
        try{
            this.config.s3 = new aws.S3({
                accessKeyId: this.config.key_id,
                secretAccessKey: this.config.key,
            });
        }catch(error){
            Config.debug ? console.log(error) : false;
            this.config.s3 = null;
            return false;
        }

        return await this.makeS3Bucket(this.config.base_path);
    }

    // Returns the database handler.
    database(){
        return this.database_handler;
    }

    // Sets user id.
    async user(user_id){
        this.config.user_id = Number(user_id);
        return this;
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

    async makeS3Bucket(){
        try{
            await this.config.s3.createBucket({ Bucket: this.config.bucket_name, CreateBucketConfiguration: { LocationConstraint: this.config.bucket_region }, }).promise();
            return true;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Creates new local file.
    async makeLocalFile(path, contents, doEncrypt, isStream, contentLength){
        let self = this;
        try{
            var readStream = contents;
            if(isStream === false){ readStream = stream.Readable.from(contents.toString(), { highWaterMark: self.config.encryptingSpeed, }); }

            readStream.pause();
            readStream.on('end', function(){ readStream.destroy(); });
            readStream.on('error', function(error){ readStream.destroy(); });

            if(doEncrypt === true){
                let encryptStream = self.createEncryptStream(self.config.encryptingSpeed, readStream, contentLength);

                readStream.resume();``
                await pipelineWithPromise(readStream, encryptStream, fs.createWriteStream(path, {flags: 'a', highWaterMark: self.config.encryptingSpeed, }));
            }else{
                readStream.resume();
                await pipelineWithPromise(readStream, fs.createWriteStream(path, {flags: 'a', highWaterMark: self.config.writingSpeed, }));
            }

            return true;
        }catch(error){ Config.debug ? console.log(error) : false; return false; }
        return false;
    }

    async makeS3File(path, contents, doEncrypt, isStream, contentLength){
        const self = this;
        const contentType = await this.getContentType(path);

        try{
            var readStream = contents;
            if(isStream === false){ readStream = stream.Readable.from(contents.toString(), { highWaterMark: self.config.encryptingSpeed, }); }

            readStream.pause();
            readStream.on('end', function(){ readStream.destroy(); });
            readStream.on('error', function(error){ console.log(error); readStream.destroy(); });

            if(doEncrypt === true){
                const encryptStream = self.createEncryptStream(self.config.encryptingSpeed, readStream, contentLength);
                const pipeline = pipelineWithoutPromise(readStream, encryptStream, (error) => { });
                return await this.config.s3.upload({
                    Bucket: this.config.bucket_name,
                    Key: path,
                    Body: pipeline,
                    ContentType: contentType,
                    ACL: 'public-read'
                }).promise().then(message => { return true; }).catch(error => { Config.debug ? console.log(error) : false; return false; });
            }else{
                readStream.resume();
                return await this.config.s3.upload({
                    Bucket: this.config.bucket_name,
                    Key: path,
                    Body: readStream,
                    ContentType: contentType,
                    ACL: 'public-read'
                }).promise().then(message => { return true; }).catch(error => { Config.debug ? console.log(error) : false; return false; });
            }

            return true;
        }catch(error){ Config.debug ? console.log(error) : false; return false; }
        return false;
    }

    async getS3FileSize(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, return size from the database.
                const model = await this.database_handler.getModel({ path: path, user_id: this.config.user_id, });
                if(model){ return model.size; }
            }

            // If database is not connected, make a request to s3.
            const headers = await this.config.s3.headObject({ Key: path, Bucket: this.config.bucket_name }).promise();
            return headers.ContentLength !== null ? headers.ContentLength : 0;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return 0;
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

    async doesS3PathExists(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, check path existence from the database.
                const model = await this.database_handler.getModel({ path: path, user_id: this.config.user_id, });
                if(model){ return true; }
            }

            // If database is not connected, make a request to s3.
            return this.config.s3.headObject({ Key: path, Bucket: this.config.bucket_name }).promise().then(headers => {
                return true;
            }).catch(error => {
                Config.debug ? console.log(error) : false;
                return false;
            });
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
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

    async searchS3Files(dirPath, query, forceRequestToS3 = false){
        try{
            var files = [];
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: dirPath, user_id: this.config.user_id, });
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
                const fileObj = await this.getS3File(file.path); // Get data for each local file.
                if(fileObj){
                    finalFiles.push(fileObj);
                }
            }

            return finalFiles;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return [];
    }

    // Private function.
    // Searches files in a local directory.
    async searchLocalFiles(dirPath, query){
        if(dirPath.toString().trim() === "*"){
            dirPath = this.config.base_path;
        }

        const isValid = await this.doesLocalPathExists(dirPath);
        if(isValid){
            const isDir = await this.isLocalPathOfDirectory(dirPath);
            if(isDir){
                var files = [];
                if(dirPath.toString().trim() === this.config.base_path){
                    files = await this.getAllFilesOfLocalDirectoryRecursively(dirPath);
                }else{
                    files = await fs.promises.readdir(dirPath).then(data => {
                        return data;
                    }).catch(error => {
                        return [];
                    });
                }

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
                    let fpath = ( dirPath === this.config.base_path ? file : (dirPath+(dirPath === "" ? "" : "/")+file) ); // getAllFilesOfLocalDirectoryRecursively returns full paths
                    console.log(fpath);
                    const fileObj = await this.getLocalFile(fpath); // Get data for each local file.
                    if(fileObj !== null){
                        finalFiles.push(fileObj);
                    }
                }

                return finalFiles;
            }else{ return []; }
        }else{ return []; }
    }

    async getS3File(fpath){
        try{
            const isValid = await this.doesS3PathExists(fpath, false);
            if(isValid){
                if(this.database_handler !== null){
                    const model = await this.database_handler.getModel({ path: fpath, user_id: this.config.user_id, });
                    if(model){
                        const obj = { name: model.name, ext: model.extension, folder: model.folder, };
                        return obj;
                    }
                }

                const parsedPath = path.parse(fpath);
                const folderPath = parsedPath.dir.replace(this.config.base_path, ""); // Remove base_path
                if(folderPath.charAt(0) === "/"){ folderPath = folderPath.substring(1); } // Remove forward slash
                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };
                return obj;
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return null;
    }

    // Private function.
    // Returns values of a local file.
    async getLocalFile(fpath){
        const isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            const isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                const parsedPath = path.parse(fpath);
                const folderPath = parsedPath.dir.replace(this.config.base_path, "");
                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };

                return obj;
            }else{ return null; }
        }else{ return null; }
    }

    // Private function.
    // Returns content type from a string for http request/response.
    async getContentType(fpath){
        try{
            const self = this;
            return mime.contentType(path.extname(fpath));
        }catch(error){}

        return null;
    }

    async getS3FileContents(path, doDecrypt){
        const self = this;
        const isValid = await self.doesS3PathExists(path, true);
        if(isValid){
            const contentType = await self.getContentType(path);

            try{
                const readStream = self.config.s3.getObject({ Bucket: self.config.bucket_name, Key: path, }).createReadStream();
                readStream.pause();
                //readStream.on('end', function(){ readStream.destroy(); }); // Destroying stream on end might sometimes cause troubles encrypting-decrypting the last chunk.
                readStream.on('error', function(error){ readStream.destroy(); });

                const speed = self.config.encryptingSpeed;
                const contentLength = await self.getS3FileSize(path, true);

                if(doDecrypt === true && self.file_protector !== null){
                    const decryptStream = self.createDecryptStream(speed, readStream, contentLength);
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
    // Gets contents of a local file.
    async getLocalFileContents(path, doDecrypt){
        const self = this;
        const isValid = await self.doesLocalPathExists(path);
        if(isValid){
            const isFile = await self.isLocalPathOfFile(path);
            const contentType = await self.getContentType(path);

            if(isFile){
                const contentLength = await self.getLocalFileSize(path);

                try{
                    const readStream = fs.createReadStream(path, { highWaterMark: self.config.readingSpeed, });
                    readStream.pause();

                    if(doDecrypt === true && self.file_protector !== null){
                        const decryptStream = self.createDecryptStream(self.config.encryptingSpeed, readStream, contentLength);
                        const pipeline = pipelineWithoutPromise(readStream, decryptStream, (error) => { });
                        readStream.pause();

                        return { contents: pipeline, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                    }else{
                        return { contents: readStream, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                    }
                }catch(error){ return { contents: null, contentType: null, contentLength: 0, readStream: null, }; }
            }
        }

        return { contents: null, contentType: null, contentLength: 0, readStream: null, };
    }

    async deleteS3File(path){
        try{
            return this.config.s3.deleteObject({ Bucket: this.config.bucket_name, Key: path }).promise().then(message => {
                return true;
            }).catch(error => {
                Config.debug ? console.log(error) : false;
                return false;
            })
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
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

    async renameS3File(path, new_path){
        const self = this;
        try{
            return self.config.s3.copyObject({ Bucket: self.config.bucket_name, CopySource: `${self.config.bucket_name}/${path}`, Key: new_path, }).promise().then(() => {
                try{ return self.config.s3.deleteObject({ Bucket: self.config.bucket_name, Key: path, }).promise().then(message => { return true; }).catch(message => { return false; }); }
                catch(error){ Config.debug ? console.log(error) : false; return false; }
            }).catch((error) => { Config.debug ? console.log(error) : false; return false; })
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
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

    async getAllFilesOfLocalDirectoryRecursively(path){
        try{
            const items = await fs.promises.readdir(path).then(async data => {
                let files = [];
                for(let item of data){
                    const isItemDir = await fs.promises.stat(`${path}/${item}`).then(stats => {return stats.isDirectory()}).catch(error => {return false;});
                    if(isItemDir){
                        const filesOfCurrentDir = await this.getAllFilesOfLocalDirectoryRecursively(`${path}/${item}`, null);
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
        }catch(error){
            Config.debug ? console.log(error) : false;
        }

        return [];
    }

    async getAllFilesOfS3Directory(path, forceRequestToS3 = false){
        try{
            if(this.database_handler !== null && forceRequestToS3 === false){
                // At large scale, making a request to s3 every time might affect the cost.
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: path, user_id: this.config.user_id, });
                if(Array.isArray(models)){ return models; }
            }else{
                // If database is not connected, make a request to s3.
                var options = { Bucket: this.config.bucket_name, };
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

    createEncryptStream(speed, readStream, fileSize){
        let self = this;
        let bytesProcessed = 0;
        let bytesEncrypted = 0;
        let bytesLeft = 0;
        let processingProgress = `0% (${bytesProcessed}/${fileSize})`;
        let encryptingProgress = `0% (${bytesEncrypted}/${fileSize})`;
        let chunkCollection = Buffer.from(""); // Used for saving chunks that can not be processed due to their length being smaller than the speed for later use.

        const encryptStream = new stream.Transform({ readableHighWaterMark: speed, writeableHighWaterMark: speed, decodeStrings: false });
        encryptStream._transform = async function(chunk, encoding, done) {
            // New processing round initiated upon data event
            readStream.pause(); // Pause the read stream until this round is finished
            chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection

            let chunksInQueue = []; // Chunks which can be encrypted in this round
            let encryptedChunks = []; // Chunks which have been encrypted in this round

            if(bytesProcessed !== fileSize){
                // Processing has not finished yet
                let bytesBeingProcessed = chunkCollection.slice(0, speed); // Chunk from chunkCollection of length equal to the speed
                const isLastChunk = (bytesBeingProcessed.length < speed && bytesLeft == bytesBeingProcessed.length) ? true : false;

                if(isLastChunk === true || bytesBeingProcessed.length >= speed/*Not last chunk but can be processed*/){
                    if(isLastChunk === true){ Config.debug ? console.log(`[Message] Last chunk to be processed`) : false; }

                    chunksInQueue.push(bytesBeingProcessed); // Allow to get encrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk which has been allowed to get encrypted, from the chunk collection

                    bytesProcessed = bytesProcessed + bytesBeingProcessed.length;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    //Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
                }else{
                    // chunkCollection length is not yet equal to the speed & it is not the turn of the last chunk yet, therefore no processing can be done.
                }

                if(chunkCollection.length > 0 && chunkCollection.length < speed && bytesLeft == chunkCollection.length){
                    // Last chunk is remaining in the chunk collection. This can sometimes happen with the aws sdk read stream.
                    // A chunk already got processed above, still there is a chunk waiting to be processed which matches the criteria for the last chunk.

                    const lastChunkLengthSaveForUseAfterCollectionSlice = bytesLeft;

                    Config.debug ? console.log(`[Message] Last chunk to be processed`) : false;

                    chunksInQueue.push(chunkCollection.slice(0, speed)); // Allow to get encrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk from the chunk collection

                    bytesProcessed = bytesProcessed + lastChunkLengthSaveForUseAfterCollectionSlice;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    //Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
                }
            }

            if(chunksInQueue.length > 0){
                // Chunks are waiting to be encrypted
                for(let chunkToEncrypt of chunksInQueue){
                    let encryptedChunk = await self.file_protector.protect(chunkToEncrypt);
                    encryptedChunks.push(encryptedChunk); // Allow to get passed in the pipeline

                    bytesEncrypted = bytesEncrypted + chunkToEncrypt.length;
                    encryptingProgress = `${Math.round((bytesEncrypted/fileSize)*100)}% (${bytesEncrypted}/${fileSize})`;
                    //Config.debug ? console.log(`[Encrypting] ${encryptingProgress}`) : false;
                }

                readStream.resume(); // Resume the read stream for new round
                done(null, Buffer.concat(encryptedChunks));
            }else{
                readStream.resume(); // Resume the read stream for new round
                done(null, null);
            }
        };

        return encryptStream;
    }

    createDecryptStream(speed, readStream, fileSize){
        let self = this;
        let bytesProcessed = 0;
        let bytesDecrypted = 0;
        let bytesLeft = 0;
        let processingProgress = `0% (${bytesProcessed}/${fileSize})`;
        let decryptingProgress = `0% (${bytesDecrypted}/${fileSize})`;
        let chunkCollection = Buffer.from(""); // Used for saving chunks that can not be processed due to their length being smaller than the speed for later use.

        let decryptStream = new stream.Transform({ readableHighWaterMark: speed, writeableHighWaterMark: speed, decodeStrings: false });
        decryptStream._transform = async function(chunk, encoding, done) {
            // New processing round initiated upon data event
            readStream.pause(); // Pause the read stream until this round is finished

            chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection

            let chunksInQueue = []; // Chunks which can be decrypted in this round
            let decryptedChunks = []; // Chunks which have been decrypted in this round

            if(bytesProcessed !== fileSize){
                // Processing has not finished yet
                let bytesBeingProcessed = chunkCollection.slice(0, speed); // Chunk from chunkCollection of length equal to the speed
                const isLastChunk = (bytesBeingProcessed.length < speed && bytesLeft == bytesBeingProcessed.length) ? true : false;

                if(isLastChunk === true || bytesBeingProcessed.length >= speed/*Not last chunk but can be processed*/){
                    if(isLastChunk === true){ Config.debug ? console.log(`[Message] Last chunk to be processed`) : false; }

                    chunksInQueue.push(bytesBeingProcessed); // Allow to get decrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk which has been allowed to get decrypted, from the chunk collection

                    bytesProcessed = bytesProcessed + bytesBeingProcessed.length;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
                }else{
                    // chunkCollection length is not yet equal to the speed & it is not the turn of the last chunk yet, therefore no processing can be done.
                }

                if(chunkCollection.length > 0 && chunkCollection.length < speed && bytesLeft == chunkCollection.length){
                    // Last chunk is remaining in the chunk collection. This can sometimes happen with the aws sdk read stream.
                    // A chunk already got processed above, still there is a chunk waiting to be processed which matches the criteria for the last chunk.

                    const lastChunkLengthSaveForUseAfterCollectionSlice = bytesLeft;

                    Config.debug ? console.log(`[Message] Last chunk to be processed`) : false;

                    chunksInQueue.push(chunkCollection.slice(0, speed)); // Allow to get decrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk from the chunk collection

                    bytesProcessed = bytesProcessed + lastChunkLengthSaveForUseAfterCollectionSlice;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
                }
            }

            if(chunksInQueue.length > 0){
                // Chunks are waiting to be decrypted
                for(let chunkToDecrypt of chunksInQueue){
                    let decryptedChunk = await self.file_protector.read(chunkToDecrypt);
                    decryptedChunks.push(decryptedChunk); // Allow to get passed in the pipeline

                    bytesDecrypted = bytesDecrypted + chunkToDecrypt.length;
                    decryptingProgress = `${Math.round((bytesDecrypted/fileSize)*100)}% (${bytesDecrypted}/${fileSize})`;
                    Config.debug ? console.log(`[Decrypting] ${decryptingProgress}`) : false;
                }

                readStream.resume(); // Resume the read stream for new round
                done(null, Buffer.concat(decryptedChunks));
            }else{
                readStream.resume(); // Resume the read stream for new round
                done(null, null);
            }
        };

        return decryptStream;
    }
}

module.exports = FCFileHandler;
