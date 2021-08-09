import Logger from '../logger.js';
import ObjectValidator from '../objectvalidator.js';
import FileHandler from '../filehandler.js';

import fs from 'fs';
import path from 'path';
import stream from 'stream';
import crypto from 'crypto';
import util from 'util';

const pipelineWithoutPromise = stream.pipeline;
const pipelineWithPromise = util.promisify(stream.pipeline);

const mega = require('megajs');

class FCMegaFileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);

        this.config = {
            ...this.config,
            email: null,
            password: null,
            mega: null,
            spaceAvailable: 0,
        }

        this.callbacks = {
            newStorage: this.callback_newStorage,
            getAccountInfo: this.callback_getAccountInfo,
            makeMegaFile: this.callback_makeMegaFile,
            renameMegaFile: this.callback_renameMegaFile,
            deleteMegaFile: this.callback_deleteMegaFile,
        }

        this.isUploading = false;
        this.isMakingDir = false;
        this.isRenaming = false;
        this.isDeleting = false;
        this.isReady = false;
    }

    // Creates new file/s in depository.
    async newFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "File_Creation", });

        if(validateConfig.success){
            if(validateConfig.object.folder !== ""){
                await this.makeMegaDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${validateConfig.object.folder.replace("FILE_EXTENSION_WISE", "")}`, 0, "root");
            }

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

                        await this.makeMegaDir(fullFolderPath, 0, "root");

                        let newMegaFileCreated = await this.makeMegaFile(`${fullFolderPath}${fullFolderPath === "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
                        if(newMegaFileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                            Logger.log("New Megafile created");
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }else{ }
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

                await this.makeMegaDir(fullFolderPath, 0, "root");

                let newMegaFileCreated = await this.makeMegaFile(
                    `${fullFolderPath}${fullFolderPath === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`,
                    finalContents,
                    validateConfig.object.isStream === true ? finalContents : null,
                    doEncrypt,
                    validateConfig.object.isStream,
                    validateConfig.object.isStream === true ? validateConfig.object.contentLength : finalContents.length,
                    false
                );
                if(newMegaFileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                    Logger.log("New Megafile created");
                    return newFCFile;
                }

                Logger.log("New Megafile creation failed");
            }
        }else{ Logger.log("New Megafile creation failed"); }

        return null;
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

            pathToFile = await this.beautifyPath(pathToFile, true);

            let response = await this.deleteMegaFile(pathToFile);
            if(response){ Logger.log("Megafile deleted"); return true; }

            Logger.log("Megafile deletion failed");
        }else{ Logger.log("Megafile deletion failed"); }

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

            let response = await this.renameMegaFile(pathToFile, newPath);
            if(response){ Logger.log("Megafile renamed"); return true; }

            Logger.log("Megafile renaming failed");
        }else{ Logger.log("Megafile renaming failed"); }

        return false;
    }

    // Gets a file from depository.
    async getFile(options){
        const self = this;
        try{
            const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
            if(validateConfig.success){
                let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                    validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
                );

                let fullPathToFile = await this.beautifyPath(pathToFile, true);

                let file = await this.getMegaFile(fullPathToFile);
                if(file){ let ext = path.extname(file.name).replace(".", "").toLowerCase(); return await self.newFCFile({ name: file.name.replace("."+ext, ""), ext: ext, folder: pathToFile.replace(file.name, ""), handler: self, isEncrypted: false, }); }
            }
        }catch(error){ Logger.log(error); }

        return null;
    }


    // Searches file in depository.
    async searchFiles(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.folder;

            let files = await this.searchMegaFiles(pathToFile.toString().trim() === "*" ? "*" : await this.beautifyPath(pathToFile, true), validateConfig.object.query, validateConfig.object.forceRequestToMega);
            if(files){
                let FCFiles = [];
                for(let file of files){
                    // When searching files with forceRequestToMega as false, FILE models are returned which have different keys for values. Example: ext/extension.
                    let ext = file.extension ? file.extension : path.extname(file.name).replace(".", "").toLowerCase();
                    FCFiles.push(await self.newFCFile({ name: file.name.replace("."+ext, ""), ext: ext, folder: file.folder, handler: self, isEncrypted: false, })); // Wrap file values in a FCFile instance. isEncrypted is not true because verification of contents is handled at FCFile's init() function.
                }

                return FCFiles;
            }
        }

        return [];
    }

    // Private function.
    // Gets size of file in depository.
    async getFileSize(path){
        return await this.getMegaFileSize(path);
    }

    // Syncs all files in the depository to the connected database.
    async syncDatabase(){
        try{
            let files = await this.getAllFilesOfMegaDirectory("*", true);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let ext = path.extname(file.name).replace(".", "").toLowerCase();

                    let FCFile = await this.newFCFile({ name: file.name.replace("."+ext, ""), ext: ext, folder: file.folder, handler: this, isEncrypted: false, }); // Wrap file values in a FCFile instance.
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

                return await this.makeMegaFile(filePath, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
            }
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Returns contents of a file in depository.
    async getFileContents(file){
        try{
            let beautifiedPath = await this.beautifyPath(file.config.folder, true);
            let filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${file.config.name}.${file.config.ext}`;

            return await this.getMegaFileContents(filePath, file.config.isEncrypted, file.config.iv);
        }catch(error){ Logger.log(error); }

        return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
    }

    /* Core/Helping/Util functions */

    async setup(){
        let self = this;
        if(self.isReady === false){
            try{
                self.config.mega = await new mega.Storage({
                    email: self.config.email,
                    password: self.config.password,
                }, (error) => self.callbacks.newStorage(error, self));

                await self.waitForReady();
                return true;
            }catch(error){
                Logger.log(error);
                self.config.mega = null;
                return false;
            }
        }

        return true;
    }

    async canAffordFile(size){
        try{
            return size <= this.config.spaceAvailable ? true : false;
        }catch(error){ Logger.log(error); }

        return false;
    }

    async waitForUploadFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isUploading === false){ resolve(); }else { setTimeout(check, 1000); }
            }

            check();
        });
    }

    async waitForDirCreation(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isMakingDir === false){ resolve(); }else { setTimeout(check, 1000); }
            }

            check();
        });
    }

    async waitForReady(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isReady === true){ resolve(); }else { setTimeout(check, 1000); }
            }

            check();
        });
    }

    async waitForRenamingFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isRenaming === false){ resolve(); }else { setTimeout(check, 1000); }
            }

            check();
        });
    }

    async waitForDeletionFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isDeleting === false){ resolve(); }else { setTimeout(check, 1000); }
            }

            check();
        });
    }

    // Private function.
    // Creates new mega file.
    async makeMegaFile(fpath, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing must be true when reading and writing from and to the same file.
        // readStream is null when isStream is false.

        const self = this;
        const contentType = await self.getContentType(fpath);

        const parsedPath = path.parse(fpath);
        const didMakeDir = await self.makeMegaDir(parsedPath.dir, 0, "root");

        if(didMakeDir === true){
            const { exists, lastFolderThatExists } = await self.getMegaDir(parsedPath.dir, "root");
            if(exists){
                try{
                    const doesFileExists = await self.getMegaFile(fpath);

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

                        // WHEN contents IS A STREAM (isStream === true) contentLength does not needs to be increased for encryptStream by 34 for IV since uniqueIV is not pushed into contentStream instead it's pushed into helperStream since contentStream.push throws error...
                        // ...therefore it will not be processed in the encryptStream, due to which encrypt stream will only need to the length of contents without IV length.
                        const encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength+(isStream === true ? 0 : 34), uniqueIV);
                        const helperStream = new stream.Transform({ readableHighWaterMark: self.config.encryptingSpeed, writeableHighWaterMark: self.config.encryptingSpeed, decodeStrings: false });
                        helperStream._transform = function(chunk, encoding, callback){ this.push(chunk); callback(); };

                        const pipeline = pipelineWithoutPromise(contentStream, encryptStream, helperStream, (error) => { Logger.log(error); });
                        contentStream.pause();

                        const uploadStream = lastFolderThatExists.upload({
                            name: parsedPath.base,
                            size: contentLength+34, // + uniqueIV length
                        }, pipeline, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                        uploadStream.on("progress", (data) => Logger.log(data));

                        self.isUploading = true;

                        if(isStream === true){
                            // If contents is a stream, contentStream is set to contents and a manual creation of contentStream is not done therefore it is required to pass the uniqueIV.
                            // contentStream.push throws error: contentStream.push is not a function, when doEncrypt is true and a mega file is being replaced (being protected) then contentStream is stream returned from megaFile.download() in getMegaFileContents, probably a delay will work.
                            // NOTE: contentStream.push throws error ONLY WHEN contentStream is stream from megaFile.download() (megajs library).
                            helperStream.push(Buffer.from(`(${uniqueIV})`));
                        }

                        contentStream.resume();

                        await self.waitForUploadFinish();
                        didMake = true;
                    }else{
                        if(isReplacing === true){
                            // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                            // contentStream is a pipeline passed from getMegaFileContents()
                            // isStream is TRUE
                            const uploadStream = lastFolderThatExists.upload({
                                name: parsedPath.base,
                                size: contentLength-34, // - uniqueIV length
                            }, contentStream, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                            uploadStream.on("progress", (data) => Logger.log(data));

                            self.isUploading = true;
                            readStream.resume();
                            await self.waitForUploadFinish();
                            didMake = true;
                        }else{
                            // contentStream is a read stream
                            const uploadStream = lastFolderThatExists.upload({
                                name: parsedPath.base,
                                size: contentLength,
                            }, contentStream, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                            uploadStream.on("progress", (data) => Logger.log(data));

                            self.isUploading = true;
                            contentStream.resume();
                            await self.waitForUploadFinish();
                            didMake = true;
                        }
                    }

                    try{
                        // Delete the old file of same name if it exists
                        if(doesFileExists && didMake === true){
                            doesFileExists.delete((error) => self.callbacks.deleteMegaFile(error, self));
                            await self.waitForDeletionFinish();

                            if(isReplacing !== true && self.database_handler){ // when replacing a new file is not being created therefore a new entry is not needed
                                fpath = self.config.basePath == "" ? fpath : fpath.replace(self.config.basePath+"/", ""); // Remove basePath
                                if(fpath.charAt(0) === "/"){ fpath = fpath.substring(1); } // Remove forward slash

                                const exists = await self.database_handler.getModel({ path: fpath, userId: self.config.userId, });
                                if(exists !== null && exists !== undefined){
                                    const modelDeleted = await self.database_handler.deleteModel({ path: fpath, userId: self.config.userId, });
                                }
                            }
                        }
                    }catch(error){ Logger.log(error); }

                    // Wait for some time to gurantee file contents write/update otherwise readFileIV will not be able to get the file IV & getFileSize will not be able to read file size since...
                    // ...it will read the file contents of old file due to early function call in case of encryption/decryption replacing.
                    let canContinue = false;
                    setTimeout(() => { canContinue = true; }, 10000);
                    const wait = await new Promise(resolve => {
                        function check(){
                            if(canContinue === true){ resolve(); }else{ setTimeout(check, 1000); }
                        }

                        check();
                    });

                    return true;
                }catch(error){ Logger.log(error); }
            }
        }

        return false;
    }

    // Private function.
    // Gets contents of a mega file.
    async getMegaFileContents(path, doDecrypt, uniqueIV){
        const self = this;
        const megaFile = await self.getMegaFile(path);
        if(megaFile){
            const contentType = await self.getContentType(path);
            const speed = self.config.encryptingSpeed;

            try{
                const readStream = megaFile.download({ initialChunkSize: speed, maxChunkSize: speed, });
                readStream.pause();
                //readStream.on('end', function(){ readStream.destroy(); }); // Destroying stream on end might sometimes cause troubles encrypting-decrypting the last chunk.
                readStream.on('error', function(error){ readStream.destroy(); });

                const contentLength = megaFile.size;

                if(doDecrypt === true && self.file_protector !== null){
                    const decryptStream = self.createDecryptStream(speed, readStream, contentLength, uniqueIV);
                    const pipeline = pipelineWithoutPromise(readStream, decryptStream, (error) => { Logger.log(error); });
                    readStream.pause();

                    return { contents: pipeline, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                }else{
                    return { contents: readStream, contentType: contentType, contentLength: contentLength, readStream: readStream, };
                }
            }catch(error){ Logger.log(error); }
        }

        return { contents: null, contentType: null, contentLength: 0, readStream: null, };
    }

    // Private function.
    // Deletes a mega file.
    async deleteMegaFile(path){
        const self = this;
        try{
            let megaFile = await self.getMegaFile(path);
            if(megaFile){
                megaFile.delete((error) => self.callbacks.deleteMegaFile(error, self));
                await self.waitForDeletionFinish();

                return true;
            }
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Renames an mega file.
    async renameMegaFile(fpath, newPath){
        const self = this;
        try{
            let megaFile = await self.getMegaFile(fpath);
            if(megaFile){
                let parsedPath = path.parse(newPath);
                megaFile.rename(parsedPath.base, (error) => self.callbacks.renameMegaFile(error, self));
                await self.waitForRenamingFinish();

                return true;
            }
        }catch(error){ Logger.log(error); }

        return false;
    }

    async getMegaDir(path, folderToGetIn = "root"){
        let self = this;
        try{
            let allFolders = path.includes("/") ? path.split('/') : path; // All folder names.
            if(typeof allFolders === "string"){ allFolders = [path]; }

            let i = 0;
            let currentFolder = folderToGetIn === "root" || !folderToGetIn ? self.config.mega.root : folderToGetIn;
            let doesExists = false;

            // Loops through currentFolder.children, updates currentFolder when folderToGet is found, keeps on doing this until last folder in path supplied is found.
            for(let folderToGet of allFolders){
                if(!currentFolder.children){ break; } // If no children in currentFolder.
                if(folderToGet.toString().trim() === ""){ continue; } // If folder is of name "", sometimes in case of last folder in path supplied.

                let folder = currentFolder.children.find(x => { return x.name !== null && x.directory !== null ? (x.name.toString().trim() === folderToGet.toString().trim() && x.directory === true) : false; })
                currentFolder = folder ? folder : currentFolder; // If folder found, update currentFolder.
                i++;

                if(i === allFolders.length && currentFolder.name.toString().trim() === folderToGet.toString().trim()){ doesExists = true; } // If last folder found.
            }

            return { exists: doesExists, lastFolderThatExists: currentFolder }; // When exists is true, lastFolderThatExists is the last folder in path supplied.
        }catch(error){ Logger.log(error); }

        return null;
    }

    async makeMegaDir(path, startIndex = 0, folderToCreateIn = "root"){
        let self = this;
        if(path && path.toString().trim() !== ""){
            const { exists, lastFolderThatExists } = await self.getMegaDir(path, folderToCreateIn); // Does folder already exists.
            if(exists === false){
                try{
                    let allFolders = path.includes("/") ? path.split('/') : path; // All folder names.
                    if(typeof allFolders === "string"){ allFolders = [path]; }

                    let i = startIndex;
                    let lastFolderFound = false; // Whether lastFolderThatExists in path supplied is already processed.
                    folderToCreateIn = folderToCreateIn === "root" || !folderToCreateIn ? self.config.mega.root : folderToCreateIn; // In which folder, should this new folder be created.

                    let folderToCreate = allFolders[i]; // Folder which should be created, identified using startIndex from allFolders.
                    let lastFolderIndex = lastFolderThatExists ? allFolders.findIndex(x => { return x.toString().trim() === lastFolderThatExists.name.toString().trim(); }) : null; // Index of lastFolderThatExists in allFolders, this keeps increasing as new folders are created.
                    if(folderToCreate !== undefined && folderToCreate !== null){
                        if(allFolders.length > 1){
                            // Multiple folder creation.
                            // example path: "folder/folder1/folder2/folder3".
                            let thisFolderIndex = allFolders.findIndex(x => { return x.toString().trim() === folderToCreate.toString().trim(); }); // Index of folder being created in allFolders.
                            thisFolderIndex = thisFolderIndex < 0 ? 0 : thisFolderIndex; // This can never happen.

                            let conditionOne = folderToCreate.toString().trim() === lastFolderThatExists.name.toString().trim(); // Folder which is being created is the lastFolderThatExists, it already exists since getMegaDir returns last folder that exists in the path as lastFolderThatExists.

                            let bothIndexsExist = thisFolderIndex !== null && thisFolderIndex !== undefined && lastFolderIndex !== null && lastFolderIndex !== undefined;
                            let thisFolderIsInParentsOfLastFolder = thisFolderIndex < lastFolderIndex; // Folder which is being created comes before lastFolderThatExists in path therefore it already exists.
                            let conditionTwo = (bothIndexsExist && (thisFolderIsInParentsOfLastFolder));

                            let isThisFolderAlreadyCreated = lastFolderThatExists && lastFolderFound === false && (conditionOne || conditionTwo);
                            if(isThisFolderAlreadyCreated === true){
                                // If folder which is being created already exists, skip to the next folder.
                                lastFolderFound = true;
                                self.isMakingDir = true;
                                self.makeMegaDir(allFolders, i+1, lastFolderThatExists); // Call this same function but with an increment in the startIndex.
                                await self.waitForDirCreation();
                                i++;
                            }else{
                                self.isMakingDir = true;
                                folderToCreateIn.mkdir(folderToCreate, async (error, data) => {
                                    if(!error){ self.isMakingDir = false; }
                                    let dirJustCreated = await self.getMegaDir(folderToCreate, folderToCreateIn);
                                    self.makeMegaDir(allFolders, i+1, dirJustCreated.lastFolderThatExists); // Call this same function but with an increment in the startIndex.
                                });
                                await self.waitForDirCreation();
                                i++;
                            }
                        }else{
                            // Single folder creation.
                            // example path: "folder".
                            self.isMakingDir = true;
                            folderToCreateIn.mkdir(folderToCreate, (error, data) => {
                                if(!error){ self.isMakingDir = false; }
                            });
                            await self.waitForDirCreation();
                            i++;
                        }

                        return true;
                    }

                    return false;
                }catch(error){ Logger.log(error); }
            }else{
                return true;
            }
        }

        return false;
    }

    // Private function.
    // Gets size of a mega file.
    async getMegaFile(fpath){
        let self = this;
        try{
            let parsedPath = path.parse(fpath);
            let foldersOnlyPath = parsedPath.dir;

            let { exists, lastFolderThatExists } = await this.getMegaDir(foldersOnlyPath, 0, "root");
            if(exists === true && lastFolderThatExists){
                let allFiles = lastFolderThatExists.children !== undefined && lastFolderThatExists.children !== null && Array.isArray(lastFolderThatExists.children) ? lastFolderThatExists.children : [];

                for(let file of allFiles){
                    try{
                        if(fpath.toString().trim().includes(file.name.toString().trim())){
                            let folderPath = `${foldersOnlyPath.split(lastFolderThatExists.name)[0]}/${lastFolderThatExists.name}`;
                            file.folder = folderPath;
                            return file;
                            break;
                        }
                    }catch(error){ Logger.log(error); }
                }
            }
        }catch(error){ Logger.log(error); }

        return null;
    }

    // Private function.
    // Searches files in a mega directory.
    async searchMegaFiles(dirPath, query, forceRequestToMega = false){
        try{
            var files = [];
            if(this.database_handler !== null && forceRequestToMega === false){
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: dirPath, userId: this.config.userId, });
                if(Array.isArray(models)){ files = models; }
            }else{
                // If database is not connected, make a request to mega.
                files = await this.getAllFilesOfMegaDirectory(dirPath, forceRequestToMega);
            }

            let filteredFiles = [];
            const querySplit = query ? query.toLowerCase().split(":") : [null, null];
            const queryType = querySplit[0];
            const queryParam = querySplit[1];

            if(query !== null && typeof query === "string"){
                if(queryType === "extension"){
                    filteredFiles = files.filter(file => {
                        return path.extname(file.name).replace(".", "").toLowerCase() === queryParam;
                    });
                }else{
                    if(queryType === "name"){
                        filteredFiles = files.filter(file => {
                            return file.name.replace(path.extname(file.name), "").toLowerCase() === queryParam;
                        });
                    }else{
                        if(queryType === "name_contains"){
                            filteredFiles = files.filter(file => {
                                return file.name.replace(path.extname(file.name), "").toLowerCase().includes(queryParam);
                            });
                        }else{ filteredFiles = files; }
                    }
                }
            }else{ filteredFiles = files; }

            let finalFiles = [...filteredFiles];
            return finalFiles;
        }catch(error){ Logger.log(error); }

        return [];
    }

    // Private function.
    // Gets size of a mega file.
    async getMegaFileSize(path){
        try{
            let megaFile = await this.getMegaFile(path);
            if(megaFile){ return megaFile.size ? megaFile.size : 0; }
        }catch(error){ Logger.log(error); }

        return 0;
    }

    // Private function.
    // Gets all files of a mega directory recursively.
    async getAllFilesOfMegaDirectoryRecursively(path){
        try{
            let files = [];
            const { exists, lastFolderThatExists } = await this.getMegaDir(path, "root");
            if(exists === true && lastFolderThatExists){
                if(lastFolderThatExists.children && Array.isArray(lastFolderThatExists.children)){
                    for(let item of lastFolderThatExists.children){
                        if(item.directory === true){
                            const filesOfCurrentDir = await this.getAllFilesOfMegaDirectoryRecursively(`${path}/${item.name}`);
                            files = [...files, ...filesOfCurrentDir];
                        }else{
                            files.push({...item, folder: path.includes(this.config.basePath) && this.config.basePath !== "" && this.config.basePath !== path ? path.replace(this.config.basePath+"/", "") : path, });
                        }
                    }
                }
            }

            return files;
        }catch(error){ Logger.log(error); }

        return [];
    }

    // Private function.
    // Gets all files of an mega directory. When * supplied as path, get files of the entire depository.
    async getAllFilesOfMegaDirectory(path, forceRequestToMega = false){
        try{
            if(this.database_handler !== null && forceRequestToMega === false){
                // If database is connected, search in the database.
                const models = await this.database_handler.getAllModels({ folder: path, userId: this.config.userId, });
                if(Array.isArray(models)){ return models; }
            }else{
                // If database is not connected, make a request to mega.
                let files = [];
                if(path.toString().trim() == "*"){
                    // Recursive.
                    return await this.getAllFilesOfMegaDirectoryRecursively(this.config.basePath);
                }

                // One directory.
                const { exists, lastFolderThatExists } = await this.getMegaDir(path, "root");
                if(exists === true && lastFolderThatExists){
                    files = lastFolderThatExists.children && Array.isArray(lastFolderThatExists.children) ? lastFolderThatExists.children.filter(x => { return x.directory === false; }) : [];

                    path = path.startsWith(this.config.basePath) ? path.replace(this.config.basePath+"/", "") : path; // Remove basePath
                    if(path.charAt(0) === "/"){ path = path.substring(1); } // Remove forward slash;

                    files = files.map(x => ({...x, folder: path, }));
                    return files;
                }

                return [];
            }
        }catch(error){ Logger.log(error); }

        return [];
    };

    // Private function.
    // Reads file to get it's unique encryption initialization vector stored with it in format of: (iv) in first 34 bytes.
    async readFileIV(path){
        let self = this;
        const megaFile = await self.getMegaFile(path);
        let canContinue = false;
        if(megaFile){
            let contents = Buffer.from("");
            let stream = megaFile.download({ start: 0, end: 34, initialChunkSize: 34, });

            stream.on("data", (data) => {
                contents = Buffer.concat([contents, data]);
            });

            stream.on("end", () => {
                contents = contents.toString();
                canContinue = true;
            });

            const wait = await new Promise(resolve => {
                function check(){
                    if(canContinue === true){
                      resolve();
                    }else {
                      setTimeout(check, 1000);
                    }
                }

                check();
            });

            if(!contents){ return null; }
            if(!contents){ return null; }
            if(contents.length === 0){ return null; }

            let readable = await contents.toString();
            let regex = /\(([^)]+)\)/;
            let match = readable.match(regex);

            if(!match){ return null; }
            if(match.length < 1){ return null; }
            if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'. < 32 for match

            return match[1];
        }

        return null;
    }

    /* Callbacks */

    async callback_newStorage(error, self){
        Logger.log(error);
        try{
            if(!error){
                self.isReady = true;
                self.config.mega.getAccountInfo((error, data) => self.callbacks.getAccountInfo(error, data, self));
            }
        }catch(error){ Logger.log(error); }
    }

    async callback_getAccountInfo(error, data, self){
        Logger.log(error);

        try{
            self.config.spaceAvailable = data ? (data.spaceTotal - data.spaceUsed) : 0;
            await self.makeMegaDir(self.config.basePath, 0, "root");
        }catch(error){ Logger.log(error); }
    }

    async callback_makeMegaFile(error, data, self){
        Logger.log([error, data]);

        try{
            self.isUploading = false;
        }catch(error){ Logger.log(error); }
    }

    async callback_renameMegaFile(error, self){
        Logger.log(error);
        try{
            self.isRenaming = false;
        }catch(error){ Logger.log(error); }
    }

    async callback_deleteMegaFile(error, self){
        Logger.log(error);
        try{
            self.isDeleting = false;
        }catch(error){ Logger.log(error); }
    }
}

export default FCMegaFileHandler;
