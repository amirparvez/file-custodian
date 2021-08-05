import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

const fs = require("fs");
const path = require('path');
const stream = require('stream');
const crypto = require('crypto');

const util = require('util');
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
                        let fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());

                        await this.makeMegaDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}`, 0, "root");

                        let newMegaFileCreated = await this.makeMegaFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
                        if(newMegaFileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                            Config.debug ? console.log("New Megafile created") : false;
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

                await this.makeMegaDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}`, 0, "root");

                let newMegaFileCreated = await this.makeMegaFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, finalContents, validateConfig.object.isStream === true ? finalContents : null, doEncrypt, validateConfig.object.isStream, validate.object.contentLength, false);
                if(newMegaFileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: fileFolder, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.
                    Config.debug ? console.log("New Megafile created", newFCFile) : false;
                    return newFCFile;
                }

                Config.debug ? console.log("New Megafile creation failed") : false;
                return null;
            }
        }else{ Config.debug ? console.log("New Megafile creation failed") : false; }
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

            let response = await this.deleteMegaFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
            if(response){ Config.debug ? console.log("Megafile deleted") : false; return true; }

            Config.debug ? console.log("Megafile deletion failed") : false; return false;
        }else{ Config.debug ? console.log("Megafile deletion failed") : false; return false; }
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

            let response = await this.renameMegaFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`, `${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${newPath}`);
            if(response){ Config.debug ? console.log("Megafile renamed") : false; return true; }

            Config.debug ? console.log("Megafile renaming failed") : false; return false;
        }else{ Config.debug ? console.log("Megafile renaming failed") : false; return false; }
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

                let file = await this.getMegaFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
                let ext = path.extname(file.name).replace(".", "").toLowerCase();
                if(file){ return await self.newFCFile({ name: file.name.replace("."+ext, ""), ext: ext, folder: pathToFile.replace(file.name, ""), handler: self, isEncrypted: false, }); }
            }
        }catch(error){}

        return null;
    }

    async joinBasePath(path){
        return `${this.config.basePath}${path === "" ? "" : "/"}${path}`;
    }

    // Searches file in depository.
    async searchFiles(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.folder;

            let files = await this.searchMegaFiles(pathToFile.toString().trim() === "*" ? "*" : await self.joinBasePath(pathToFile), validateConfig.object.query, validateConfig.object.forceRequestToMega);
            if(files){
                let FCFiles = [];
                for(let file of files){
                    let ext = path.extname(file.name).replace(".", "").toLowerCase();
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
        return await this.getMegaFileSize(path, true);
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

                return await this.makeMegaFile(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
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

            return await this.getMegaFileContents(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, file.config.isEncrypted, file.config.iv);
        }catch(error){
            return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
        }
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
                Config.debug ? console.log(error) : false;
                self.config.mega = null;
                return false;
            }
        }

        return true;
    }

    async canAffordFile(size){
        try{
            return size <= this.config.spaceAvailable ? true : false;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    async waitForUploadFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isUploading === false){
                  resolve();
                }else {
                  setTimeout(check, 1000);
                }
            }

            check();
        });
    }

    async waitForDirCreation(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isMakingDir === false){
                  resolve();
                }else {
                  setTimeout(check, 1000);
                }
            }

            check();
        });
    }

    async waitForReady(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isReady === true){
                  resolve();
                }else {
                  setTimeout(check, 1000);
                }
            }

            check();
        });
    }

    async waitForRenamingFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isRenaming === false){
                  resolve();
                }else {
                  setTimeout(check, 1000);
                }
            }

            check();
        });
    }

    async waitForDeletionFinish(){
        const self = this;
        return new Promise(resolve => {
            function check(){
                if(self.isDeleting === false){
                  resolve();
                }else {
                  setTimeout(check, 1000);
                }
            }

            check();
        });
    }

    // Private function.
    // Creates new mega file.
    async makeMegaFile(fpath, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing must be true when reading and writing from and to the same file.
        const self = this;
        const contentType = await self.getContentType(fpath);

        const parsedPath = path.parse(fpath);
        const didMakeDir = await self.makeMegaDir(parsedPath.dir, 0, "root");

        if(didMakeDir === true){
            const { exists, lastFolderThatExists } = await self.getMegaDir(parsedPath.dir, "root");
            if(exists){
                try{
                    let doesFileExists = await self.getMegaFile(fpath);
                    var contentStream = contents;
                    if(isStream === false){ contentStream = stream.Readable.from(contents.toString(), { highWaterMark: self.config.encryptingSpeed, }); }

                    contentStream.pause();
                    contentStream.on('end', function(){ contentStream.destroy(); });
                    contentStream.on('error', function(error){ contentStream.destroy(); });

                    if(doEncrypt === true){
                        let uniqueIV = crypto.randomBytes(16).toString('hex');
                        const encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength, uniqueIV);
                        const helperStream = new stream.Transform({ readableHighWaterMark: self.config.encryptingSpeed, writeableHighWaterMark: self.config.encryptingSpeed, decodeStrings: false });
                        helperStream._transform = async function(chunk, encoding, callback){
                            this.push(chunk);
                            callback();
                        };

                        const pipeline = pipelineWithoutPromise(contentStream, encryptStream, helperStream, (error) => { });

                        lastFolderThatExists.upload({
                            name: parsedPath.base,
                            size: contentLength+34, // + uniqueIV length
                        }, helperStream, (error, data) => self.callbacks.makeMegaFile(error, data, self)); // Passing pipeline as source/data does not works as expected therefore helperStream is passed

                        self.isUploading = true;
                        helperStream.push(Buffer.from(`(${uniqueIV})`)); // contentStream.push throws error : contentStream.push is not a function
                        contentStream.resume();
                        await self.waitForUploadFinish();
                        try{
                            // Delete the old file of same name if it exists
                            if(doesFileExists){
                                doesFileExists.delete((error) => self.callbacks.deleteMegaFile(error, self));
                                await self.waitForDeletionFinish();
                            }
                        }catch(error){}
                    }else{
                        if(isReplacing){
                            // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                            // contentStream is a pipeline passed from getMegaFileContents()
                            lastFolderThatExists.upload({
                                name: parsedPath.base,
                                size: contentLength-34, // - uniqueIV length
                            }, contentStream, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                            self.isUploading = true;
                            readStream.resume();
                            await self.waitForUploadFinish();
                            try{
                                // Mega creates a new file with the same name with decrypted contents therefore it is needed to delete the old one if it exists
                                if(doesFileExists){
                                    doesFileExists.delete((error) => self.callbacks.deleteMegaFile(error, self));
                                    await self.waitForDeletionFinish();
                                }
                            }catch(error){}
                        }else{
                            // contentStream is a read stream
                            lastFolderThatExists.upload({
                                name: parsedPath.base,
                                size: contentLength,
                            }, contentStream, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                            self.isUploading = true;
                            contentStream.resume();
                            await self.waitForUploadFinish();
                        }
                    }

                    return true;
                }catch(error){ Config.debug ? console.log(error) : false; }
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
        }catch(error){ Config.debug ? console.log(error) : false; }

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
        }catch(error){ Config.debug ? console.log(error) : false; }

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
        }catch(error){ Config.debug ? console.log(error) : false; }

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
                }catch(error){ Config.debug ? console.log(error) : false; }
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
                    }catch(error){ Config.debug ? console.log(error) : false; }
                }
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

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

            let finalFiles = [];
            for(let file of filteredFiles){
                finalFiles.push(file);
            }

            return finalFiles;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return [];
    }

    // Private function.
    // Gets size of a mega file.
    async getMegaFileSize(path){
        try{
            let megaFile = await this.getMegaFile(path);
            if(megaFile){ return megaFile.size ? megaFile.size : 0; }
        }catch(error){ Config.debug ? console.log(error) : false; }

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
                            files.push({...item, folder: path.includes(this.config.basePath) ? path.replace(this.config.basePath, "") : path, });
                        }
                    }
                }
            }

            return files;
        }catch(error){
            Config.debug ? console.log(error) : false;
        }

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
                    files = files.map(x => ({...x, folder: path, }));
                    return files;
                }

                return [];
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

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
            if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'.

            return match[1];
        }

        return null;
    }

    /* Callbacks */

    async callback_newStorage(error, self){
        Config.debug ? console.log(error) : false;
        try{
            if(!error){
                self.isReady = true;
                self.config.mega.getAccountInfo((error, data) => self.callbacks.getAccountInfo(error, data, self));
            }
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_getAccountInfo(error, data, self){
        Config.debug ? console.log(error) : false;

        try{
            self.config.spaceAvailable = data ? (data.spaceTotal - data.spaceUsed) : 0;
            await self.makeMegaDir(self.config.basePath, 0, "root");
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_makeMegaFile(error, data, self){
        Config.debug ? console.log(error, data) : false;
        try{
            self.isUploading = false;
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_renameMegaFile(error, self){
        Config.debug ? console.log(error) : false;
        try{
            self.isRenaming = false;
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_deleteMegaFile(error, self){
        Config.debug ? console.log(error) : false;
        try{
            self.isDeleting = false;
        }catch(error){ Config.debug ? console.log(error) : false; }
    }
}

module.exports = FCMegaFileHandler;
