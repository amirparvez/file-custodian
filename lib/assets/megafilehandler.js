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
        }

        this.isUploading = false;
    }

    // Creates new file/s in depository.
    async newFile(options){
        const self = this;
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
                        let fileFolder = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());

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

    /* Core/Helping/Util functions */

    async setup(){
        let self = this;
        try{
            self.config.mega = await new mega.Storage({
                email: self.config.email,
                password: self.config.password,
            }, (error) => self.callbacks.newStorage(error, self));

            return true;
        }catch(error){
            Config.debug ? console.log(error) : false;
            self.config.mega = null;
            return false;
        }

        return false;
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
                  console.log('met');
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
    async makeMegaFile(path, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing must be true when reading and writing from and to the same file.
        const self = this;
        const contentType = await self.getContentType(path);

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
                // pipeline
            }else{
                if(isReplacing){
                    // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                    // contentStream is a pipeline passed from getMegaFileContents()
                    readStream.resume();
                    // cs
                }else{
                    // contentStream is a read stream
                    self.config.mega.root.upload({
                        name: path,
                        size: contentLength,
                    }, contentStream, (error, data) => self.callbacks.makeMegaFile(error, data, self));

                    self.isUploading = true;
                    contentStream.resume();

                    console.log("started uploading ", self.isUploading);
                    await self.waitForUploadFinish();
                    console.log("uploaded ", self.isUploading);
                }
            }

            return true;
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    // Private function.
    // Gets size of file in depository.
    async getFileSize(path){
        return await this.getMegaFileSize(path, true);
        //return 0;
    }

    async makeMegaDir(path){
        let self = this;
        try{
            let allFolders = path.includes("/") ? path.split('/') : path;
            if(typeof allFolders === "string"){ allFolders = [path]; }

            console.log(allFolders, " allFolders");

            let i = 0;
            for(let folderToCreate of allFolders){
                console.log("loop, ", folderToCreate, allFolders[i+1]);
                if(allFolders.length > 0){
                    self.config.mega.root.mkdir(folderToCreate, (error, data) => { console.log(error, data); self.makeMegaDir(allFolders[i+1]); });
                    i++;
                }else{
                    self.config.mega.root.mkdir(folderToCreate, (error, data) => { console.log(error, data); });
                    i++;
                }
            }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return false;
    }

    async getMegaFile(fpath){
        let self = this;
        try{
            let parsedPath = path.parse(fpath);
            let foldersOnlyPath = parsedPath.dir.replace(self.config.basePath, "");

            console.log("foldersOnlyPath ", foldersOnlyPath);

            let folderExists = await this.makeMegaDir(foldersOnlyPath);
            if(folderExists){
                let allRootFiles = self.config.mega.root.children;

                console.log("allRootFiles ", allRootFiles.length);
                for(let file of allRootFiles){
                    try{
                        if(fpath.toString().includes(file.name)){
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
    // Gets size of a mega file.
    async getMegaFileSize(path){
        try{
            let megaFile = await this.getMegaFile(path);
            if(megaFile){ return megaFile.size ? megaFile.size : 0; }
        }catch(error){ Config.debug ? console.log(error) : false; }

        return 0;
    }

    /* Callbacks */

    async callback_newStorage(error, self){
        Config.debug ? console.log(error) : false;
        try{
            console.log(self.config.mega);
            self.config.mega.getAccountInfo((error, data) => self.callbacks.getAccountInfo(error, data, self));
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_getAccountInfo(error, data, self){
        Config.debug ? console.log(error) : false;

        try{
            self.config.spaceAvailable = data ? (data.spaceTotal - data.spaceUsed) : 0;
        }catch(error){ Config.debug ? console.log(error) : false; }
    }

    async callback_makeMegaFile(error, data, self){
        Config.debug ? console.log(error, data) : false;
        try{
            self.isUploading = false;
        }catch(error){ Config.debug ? console.log(error) : false; }
    }
}

module.exports = FCMegaFileHandler;
