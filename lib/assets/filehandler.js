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
const stream = require('stream');
const mime = require('mime-types');

const util = require('util');
const pipelineWithoutPromise = stream.pipeline;

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            type: null,
            basePath: null,
            userId: null,
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

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    // Returns the database handler.
    database(){
        return this.database_handler;
    }

    // Sets user id.
    user(userId){
        this.config.userId = Number(userId);
        return this;
    }

    // Creates new database/database handler.
    async newDatabase(options){
        if(options && typeof options === "object"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "DatabaseHandler", });

            if(!validateConfig.success){ Config.debug ? console.log(`[FILEHANDLER:${this.config.name}] New database handler creation failed`) : false; }

            if(validateConfig.object.system == "mysql" || validateConfig.object.system == "postgres" || validateConfig.object.system == "mariadb"){
                this.database_handler = new FCMySQLHandler({ system: validateConfig.object.system, database: validateConfig.object.database, userName: validateConfig.object.userName, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, tableName: validateConfig.object.tableName, properDelete: validateConfig.object.properDelete, sequelizeInstance: validateConfig.object.sequelizeInstance, userModel: validateConfig.object.userModel, });
            }else{
                if(validateConfig.object.system == "mongodb"){
                    this.database_handler = new FCMongoDBHandler({ system: validateConfig.object.system, url: validateConfig.object.url, tableName: validateConfig.object.tableName, properDelete: validateConfig.object.properDelete, });
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
    // Returns content type from a string for http request/response.
    async getContentType(fpath){
        try{
            const self = this;
            return mime.contentType(path.extname(fpath));
        }catch(error){}

        return null;
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
    // Gets contents of a local file.
    async getLocalFileContents(path, doDecrypt, uniqueIV){
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
                        const decryptStream = self.createDecryptStream(self.config.encryptingSpeed, readStream, contentLength, uniqueIV);
                        const pipeline = pipelineWithoutPromise(readStream, decryptStream, (error) => { Config.debug ? console.log(error) : false; });
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

    // Private function.
    // Creates a transform stream which encrypts the data received from a read stream.
    createEncryptStream(speed, readStream, fileSize, uniqueIV){
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

            let isDoneCalledAlready = false;

            if(bytesProcessed === 0){
                // Remove initialization vector from the first chunk
                let isIVPresent = chunk.includes(`(${uniqueIV})`);
                if(isIVPresent === true){
                    if(chunk.length === 34){
                        // This is a manual push of uniqueIV from makeS3File
                        // Skip processing since slicing this chunk will make it empty and it will be marked as last chunk due to bytesLeft(0) === bytesBeingProcessed.length(0)

                        done(null, chunk);
                        isDoneCalledAlready = true;
                    }else{
                        chunk = chunk.slice(34);
                        fileSize = fileSize-34;

                        chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection
                    }
                }else{ chunkCollection = Buffer.concat([chunkCollection, chunk]); /* Add this chunk in chunkCollection */ }
            }else{
                chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection
            }

            let chunksInQueue = []; // Chunks which can be encrypted in this round
            let encryptedChunks = []; // Chunks which have been encrypted in this round

            if(bytesProcessed !== fileSize && chunkCollection.length > 0){
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
                    Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
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
                    Config.debug ? console.log(`[Processing] ${processingProgress}`) : false;
                }
            }

            if(chunksInQueue.length > 0){
                // Chunks are waiting to be encrypted
                for(let chunkToEncrypt of chunksInQueue){
                    let encryptedChunk = await self.file_protector.protect(chunkToEncrypt, uniqueIV);
                    encryptedChunks.push(encryptedChunk); // Allow to get passed in the pipeline

                    bytesEncrypted = bytesEncrypted + chunkToEncrypt.length;
                    encryptingProgress = `${Math.round((bytesEncrypted/fileSize)*100)}% (${bytesEncrypted}/${fileSize})`;
                    Config.debug ? console.log(`[Encrypting] ${encryptingProgress}`) : false;
                }

                readStream.resume(); // Resume the read stream for new round
                try{
                    isDoneCalledAlready === false ? done(null, Buffer.concat(encryptedChunks)) : false;;
                }catch(error){
                    isDoneCalledAlready === false ? done(null, null) : false;
                }
            }else{
                readStream.resume(); // Resume the read stream for new round
                isDoneCalledAlready === false ? done(null, null) : false;
            }
        };

        return encryptStream;
    }

    // Private function.
    // Creates a transform stream which decrypts the data received from a read stream.
    createDecryptStream(speed, readStream, fileSize, uniqueIV){
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

            let isDoneCalledAlready = false;

            if(bytesProcessed === 0){
                // Remove initialization vector from the first chunk
                let isIVPresent = chunk.includes(`(${uniqueIV})`);
                if(isIVPresent === true){ chunk = chunk.slice(34); fileSize = fileSize-34; }
                chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection
            }else{
                chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this chunk in chunkCollection
            }

            let chunksInQueue = []; // Chunks which can be decrypted in this round
            let decryptedChunks = []; // Chunks which have been decrypted in this round

            if(bytesProcessed !== fileSize && chunkCollection.length > 0){
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
                    let decryptedChunk = await self.file_protector.read(chunkToDecrypt, uniqueIV);
                    decryptedChunks.push(decryptedChunk); // Allow to get passed in the pipeline

                    bytesDecrypted = bytesDecrypted + chunkToDecrypt.length;
                    decryptingProgress = `${Math.round((bytesDecrypted/fileSize)*100)}% (${bytesDecrypted}/${fileSize})`;
                    Config.debug ? console.log(`[Decrypting] ${decryptingProgress}`) : false;
                }

                readStream.resume(); // Resume the read stream for new round
                try{
                    isDoneCalledAlready === false ? done(null, Buffer.concat(decryptedChunks)) : false;;
                }catch(error){
                    isDoneCalledAlready === false ? done(null, null) : false;
                }
            }else{
                readStream.resume(); // Resume the read stream for new round
                isDoneCalledAlready === false ? done(null, null) : false;
            }
        };

        return decryptStream;
    }
}

module.exports = FCFileHandler;
