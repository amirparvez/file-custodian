import Logger from './misc/logger.js';
import ObjectValidator from './misc/objectvalidator.js';
import FCMongoDBHandler from './databasehandlers/mongodbhandler.js';
import FCMySQLHandler from './databasehandlers/mysqlhandler.js';
import FCFile from './file.js';
import FCFileProtector from './fileprotector.js';
import FCReadableStream from './misc/readablestream.js';

import fs from 'fs';
import path from 'path';
import stream from 'stream';
import multiparty from 'multiparty';
import mime from 'mime-types';
import util from 'util';

const pipelineWithoutPromise = stream.pipeline;

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            name: null,
            type: null,
            basePath: null,
            userId: null,
            readingSpeed: 16384,
            writingSpeed: 16384,
            encryptingSpeed: 16384,
        };

        this.database_handler = null; // File handler can have one database handler.
        this.file_protector = null; // File handler can have one file protector.
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            return await this.setup();

            Logger.log("New file handler initialized");
        }else{ Logger.log("New file handler initialization failed"); }

        return false;
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

            if(!validateConfig.success){ Logger.log(`[FILEHANDLER:${this.config.type}] New database handler creation failed`); }

            if(validateConfig.object.system == "mysql" || validateConfig.object.system == "postgres" || validateConfig.object.system == "mariadb"){
                this.database_handler = new FCMySQLHandler({ system: validateConfig.object.system, database: validateConfig.object.database, userName: validateConfig.object.userName, password: validateConfig.object.password, host: validateConfig.object.host, port: validateConfig.object.port, tableName: validateConfig.object.tableName, properDelete: validateConfig.object.properDelete, sequelizeInstance: validateConfig.object.sequelizeInstance, userModel: validateConfig.object.userModel, });
            }else{
                if(validateConfig.object.system == "mongodb"){
                    this.database_handler = new FCMongoDBHandler({ system: validateConfig.object.system, url: validateConfig.object.url, tableName: validateConfig.object.tableName, properDelete: validateConfig.object.properDelete, });
                }
            }

            if(validateConfig.success){ Logger.log(`[FILEHANDLER:${this.config.type}] New database handler created`); return true; }
        }else{ Logger.error("c_idbho"); }

        return false;
    }

    // Creates new file protector.
    async newProtector(options){
        if(options && typeof options === "object"){
            const validateConfig = await ObjectValidator.validate({ object: options, against: "FileProtector", });

            if(!validateConfig.success){ Logger.log(`[FILEHANDLER:${this.config.type}] New file protector creation failed`); return false; }

            this.file_protector = new FCFileProtector({ algorithm: validateConfig.object.algorithm,});

            if(validateConfig.success){ Logger.log(`[FILEHANDLER:${this.config.type}] New file protector created`); return true; }
        }else{ Logger.error("c_ifpo"); }

        return false;
    }

    // Private function.
    // Returns content type from a string for http request/response.
    async getContentType(fpath){
        try{
            const self = this;
            return mime.contentType(path.extname(fpath));
        }catch(error){ Logger.log(error); }

        return null;
    }

    // Private function.
    // Returns a new FCFile instance.
    async newFCFile(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "File", });

        if(validateConfig.success){
            let newFile = new FCFile(options);
            await newFile.init();
            Logger.log("New FCFile created");

            return newFile;
        }else{ Logger.log("New FCFile creation failed"); }

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

                Logger.log("Extraction of files from HTTP request successful");
                return files.file ? files.file : [];
            }catch(error){ Logger.log(["Extraction of files from HTTP request failed", error]); }
        }else{ Logger.log("Extraction of files from HTTP request failed"); }

        return [];
    }

    // Private function.
    // Gets size of a local file.
    async getLocalFileSize(path) {
        const response = await fs.promises.stat(path).then(data => {
            return data.size;
        }).catch(error => {
            Logger.log(error);
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
            Logger.log(error);
            return false;
        });
    }

    // Private function.
    // Checks if a local path is of a file.
    async isLocalPathOfFile(path){
        return await fs.promises.stat(path).then(data => {
            return data.isFile();
        }).catch(error => {
            Logger.log(error);
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
                        const pipeline = pipelineWithoutPromise(readStream, decryptStream, (error) => { Logger.log(error); });
                        readStream.pause();

                        return { contents: pipeline, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                    }else{
                        return { contents: readStream, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                    }
                }catch(error){ Logger.log(error); }
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
        let bytesLeft = fileSize;
        let processingProgress = `0% (${bytesProcessed}/${fileSize})`;
        let encryptingProgress = `0% (${bytesEncrypted}/${fileSize})`;
        let chunkCollection = Buffer.from(""); // Used for saving chunks that can not be processed due to their length being smaller than the speed for later use.

        const encryptStream = new stream.Transform({ readableHighWaterMark: speed, writeableHighWaterMark: speed, decodeStrings: false });
        encryptStream._transform = async function(chunkR, encoding, done) {
            // New processing round initiated upon data event
            readStream.pause(); // Pause the read stream until this round is finished

            var chunk = null;
            if(Buffer.isBuffer(chunkR)){ chunk = chunkR; }else{ chunk = Buffer.from(chunkR); }

            let isDoneCalledAlready = false;

            if(bytesProcessed === 0){
                // Remove initialization vector from the first chunk
                let isIVPresent = chunk.includes(`(${uniqueIV})`);
                if(isIVPresent === true){
                    if(chunk.length === 34){
                        // This is a manual push of uniqueIV from makeFile
                        // Skip processing since slicing this chunk will make it empty and it will be marked as last chunk due to bytesLeft(0) === bytesBeingProcessed.length(0)

                        this.push(chunk);

                        bytesProcessed = bytesProcessed + chunk.length;
                        bytesLeft = fileSize - bytesProcessed;
                        processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                        Logger.log(`[Processing] ${processingProgress}`);

                        done(null);
                        isDoneCalledAlready = true;
                    }else{
                        let ivSlice = chunk.slice(0, 34);
                        this.push(ivSlice); // Push uniqueIV

                        bytesProcessed = bytesProcessed + ivSlice.length;
                        bytesLeft = fileSize - bytesProcessed;
                        processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                        Logger.log(`[Processing] ${processingProgress}`);

                        chunk = chunk.slice(34, chunk.length); // Chunk excluding the uniqueIV
                        chunkCollection = Buffer.concat([chunkCollection, chunk]); // Add this remaining chunk in chunkCollection
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
                    if(isLastChunk === true){ Logger.log(`[Message] Last chunk to be processed`); }

                    chunksInQueue.push(bytesBeingProcessed); // Allow to get encrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk which has been allowed to get encrypted, from the chunk collection

                    bytesProcessed = bytesProcessed + bytesBeingProcessed.length;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Logger.log(`[Processing] ${processingProgress}`);
                }else{
                    // chunkCollection length is not yet equal to the speed & it is not the turn of the last chunk yet, therefore no processing can be done.
                }

                if(chunkCollection.length > 0 && chunkCollection.length < speed && bytesLeft == chunkCollection.length){
                    // Last chunk is remaining in the chunk collection. This can sometimes happen with the aws sdk read stream.
                    // A chunk already got processed above, still there is a chunk waiting to be processed which matches the criteria for the last chunk.

                    const lastChunkLengthSaveForUseAfterCollectionSlice = bytesLeft;

                    Logger.log(`[Message] Last chunk to be processed`);

                    chunksInQueue.push(chunkCollection.slice(0, speed)); // Allow to get encrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk from the chunk collection

                    bytesProcessed = bytesProcessed + lastChunkLengthSaveForUseAfterCollectionSlice;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Logger.log(`[Processing] ${processingProgress}`);
                }
            }

            if(chunksInQueue.length > 0){
                // Chunks are waiting to be encrypted
                for(let chunkToEncrypt of chunksInQueue){
                    let encryptedChunk = await self.file_protector.protect(chunkToEncrypt, uniqueIV);
                    encryptedChunks.push(encryptedChunk); // Allow to get passed in the pipeline

                    bytesEncrypted = bytesEncrypted + chunkToEncrypt.length;
                    encryptingProgress = `${Math.round((bytesEncrypted/fileSize)*100)}% (${bytesEncrypted}/${fileSize})`;
                    Logger.log(`[Encrypting] ${encryptingProgress}`);
                }

                readStream.resume(); // Resume the read stream for new round
                try{
                    this.push(Buffer.concat(encryptedChunks));
                    isDoneCalledAlready === false ? done(null) : false;;
                }catch(error){
                    isDoneCalledAlready === false ? done(null) : false;
                }
            }else{
                readStream.resume(); // Resume the read stream for new round
                isDoneCalledAlready === false ? done(null) : false;
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
        let bytesLeft = fileSize;
        let processingProgress = `0% (${bytesProcessed}/${fileSize})`;
        let decryptingProgress = `0% (${bytesDecrypted}/${fileSize})`;
        let chunkCollection = Buffer.from(""); // Used for saving chunks that can not be processed due to their length being smaller than the speed for later use.

        let decryptStream = new stream.Transform({ readableHighWaterMark: speed, writeableHighWaterMark: speed, decodeStrings: false });
        decryptStream._transform = async function(chunkR, encoding, done) {
            // New processing round initiated upon data event
            readStream.pause(); // Pause the read stream until this round is finished

            var chunk = null;
            if(Buffer.isBuffer(chunkR)){ chunk = chunkR; }else{ chunk = Buffer.from(chunkR); }

            let isDoneCalledAlready = false;

            if(bytesProcessed === 0){
                // Remove initialization vector from the first chunk
                let isIVPresent = chunk.includes(`(${uniqueIV})`);
                if(isIVPresent === true){
                    chunk = chunk.slice(34);
                    fileSize = fileSize-34;
                    bytesLeft = fileSize; // Update bytesLeft since fileSize is updated and its first chunk.
                }

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
                    if(isLastChunk === true){ Logger.log(`[Message] Last chunk to be processed`); }

                    chunksInQueue.push(bytesBeingProcessed); // Allow to get decrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk which has been allowed to get decrypted, from the chunk collection

                    bytesProcessed = bytesProcessed + bytesBeingProcessed.length;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Logger.log(`[Processing] ${processingProgress}`);
                }else{
                    // chunkCollection length is not yet equal to the speed & it is not the turn of the last chunk yet, therefore no processing can be done.
                }

                if(chunkCollection.length > 0 && chunkCollection.length < speed && bytesLeft == chunkCollection.length){
                    // Last chunk is remaining in the chunk collection. This can sometimes happen with the aws sdk read stream.
                    // A chunk already got processed above, still there is a chunk waiting to be processed which matches the criteria for the last chunk.

                    const lastChunkLengthSaveForUseAfterCollectionSlice = bytesLeft;

                    Logger.log(`[Message] Last chunk to be processed`);

                    chunksInQueue.push(chunkCollection.slice(0, speed)); // Allow to get decrypted
                    chunkCollection = chunkCollection.slice(speed); // Remove the chunk from the chunk collection

                    bytesProcessed = bytesProcessed + lastChunkLengthSaveForUseAfterCollectionSlice;
                    bytesLeft = fileSize - bytesProcessed;
                    processingProgress = `${Math.round((bytesProcessed/fileSize)*100)}% (${bytesProcessed}/${fileSize})`;
                    Logger.log(`[Processing] ${processingProgress}`);
                }
            }

            if(chunksInQueue.length > 0){
                // Chunks are waiting to be decrypted
                for(let chunkToDecrypt of chunksInQueue){
                    let decryptedChunk = await self.file_protector.read(chunkToDecrypt, uniqueIV);
                    decryptedChunks.push(decryptedChunk); // Allow to get passed in the pipeline

                    bytesDecrypted = bytesDecrypted + chunkToDecrypt.length;
                    decryptingProgress = `${Math.round((bytesDecrypted/fileSize)*100)}% (${bytesDecrypted}/${fileSize})`;
                    Logger.log(`[Decrypting] ${decryptingProgress}`);
                }

                readStream.resume(); // Resume the read stream for new round
                try{
                    this.push(Buffer.concat(decryptedChunks));
                    isDoneCalledAlready === false ? done(null) : false;;
                }catch(error){
                    isDoneCalledAlready === false ? done(null) : false;
                }
            }else{
                readStream.resume(); // Resume the read stream for new round
                isDoneCalledAlready === false ? done(null) : false;
            }
        };

        return decryptStream;
    }

    // Private function.
    // Creates a stream which reads the data.
    createDataReadStream(data, speed){
        return new FCReadableStream({ _fcData: data, highWaterMark: speed });
    }

    // Private function.
    // Fixes any errors in a path.
    // Path must never start or end with a '/'.
    async beautifyPath(path, returnWithBasePath = false){
        let finalPath = "";

        finalPath = path.trim();
        finalPath = finalPath.replace(/\\/g, "/"); // Convert back slashes to forward slashes.
        finalPath = finalPath.replace(/\/\//g, '/'); // Convert each double slashes to a single slash

        if(finalPath.charAt(0) == '/'){
            // Remove the first forward slash
            finalPath = finalPath.substring(1);
        }else{}


        if(finalPath.charAt((finalPath.length - 1)) == '/'){
            // Remove the last forward slash
            finalPath = finalPath.substring(0, finalPath.length - 1);
        }else{}

        let bBasePath = returnWithBasePath === true ? await this.beautifyPath(this.config.basePath, false) : "";
        return returnWithBasePath === true ? `${bBasePath}${finalPath !== "" && bBasePath !== "" ? "/" : ""}${finalPath}` : finalPath;
    }

    // Private function.
    // Returns file schema name based on depository/file handler type.
    async getFileSchemaNameFromFH(fh = null){
        fh = fh === null || fh === undefined ? this : fh;
        return fh.config.type == "local-server" ? "LSFile" : fh.config.type == "aws-s3" ? "S3File" : fh.config.type == "do-spaces" ? "DOFile" : fh.config.type == "mega" ? "MEGAFile" : fh.config.type == "bb-b2" ? "B2File" : "File";
    }
}

export default FCFileHandler;
