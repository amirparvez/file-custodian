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

class FCLocalServerFileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);
    }

    // Creates new file/s in depository.
    async newFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "File_Creation", });

        if(validateConfig.success){
            if(validateConfig.object.folder !== ""){
                await this.makeLocalDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${validateConfig.object.folder.replace("FILE_EXTENSION_WISE", "")}`);
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

                        await this.makeLocalDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}`);

                        let newLocalFileCreated = await this.makeLocalFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
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

                await this.makeLocalDir(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}`);

                let finalContents = validateConfig.object.contents;
                let doEncrypt = false;
                let didEncrypt = false;
                if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                    // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                    doEncrypt = true;
                    // Encrypt contents while writing the file.
                }

                let newLocalFileCreated = await this.makeLocalFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${fileFolder}${fileFolder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`, finalContents, validateConfig.object.isStream === true ? finalContents : null, doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, false);
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

            let response = await this.deleteLocalFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
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

            let newPath = validateConfig.object.newPath ? validateConfig.object.newPath : (
                validateConfig.object.newName && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.newName}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return false;
            }

            let response = await this.renameLocalFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`, `${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${newPath}`);
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

            let file = await this.getLocalFile(`${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`);
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

            let files = await this.searchLocalFiles(pathToFile.toString().trim() === "*" ? "*" : `${self.config.basePath}${self.config.basePath === "" ? "" : "/"}${pathToFile}`, validateConfig.object.query);
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
            let files = await this.getAllFilesOfLocalDirectoryRecursively(this.config.basePath);
            console.log(files);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let data = await this.getLocalFile(file);
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

                return await this.makeLocalFile(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
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

            return await this.getLocalFileContents(`${this.config.basePath}${this.config.basePath === "" ? "" : "/"}${filePath}`, file.config.isEncrypted, file.config.iv);
        }catch(error){
            return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
        }
    }

    /* Core/Helping/Util functions */

    async setup(){
        return await this.makeLocalDir(this.config.basePath);
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

    // Private function.
    // Creates new local file.
    async makeLocalFile(path, contents, readStream, doEncrypt, isStream, contentLength, isReplacing = false){
        // isReplacing, when true, stores the contents in a temp file and writes them to the file at path. isReplacing must be true when reading and writing from and to the same file.
        let self = this;
        try{
            var contentStream = contents;
            if(isStream === false){ contentStream = stream.Readable.from(contents.toString(), { highWaterMark: self.config.encryptingSpeed, }); }

            contentStream.pause();
            contentStream.on('end', function(){ contentStream.destroy(); });
            contentStream.on('error', function(error){ contentStream.destroy(); });

            let random = Math.floor(Math.random()*1000000000000000000000)+100000000000000000000;
            let finalPath = isReplacing === true ? `${self.config.basePath}/temp/temp-${random}.temp` : `${path}`;

            if(isReplacing){ await self.makeLocalDir(`${self.config.basePath}/temp`); }

            if(doEncrypt === true){
                let uniqueIV = crypto.randomBytes(16).toString('hex');
                let encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength, uniqueIV);
                let writeStream = fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.encryptingSpeed, });
                writeStream.write(`(${uniqueIV})`);

                contentStream.resume();
                await pipelineWithPromise(contentStream, encryptStream, writeStream).catch(error => { Config.debug ? console.log(error) : false; });
            }else{
                if(isReplacing){
                    // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                    // contentStream is a pipeline passed from getLocalFileContents()
                    readStream.resume();
                    await pipelineWithPromise(contentStream, fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.writingSpeed, })).catch(error => { Config.debug ? console.log(error) : false; });
                }else{
                    // contentStream is a read stream
                    contentStream.resume();
                    await pipelineWithPromise(contentStream, fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.writingSpeed, })).catch(error => { Config.debug ? console.log(error) : false; });
                }
            }

            if(isReplacing){
                try{
                    let doesTempFileExists = await self.doesLocalPathExists(finalPath);
                    if(doesTempFileExists){
                        await pipelineWithPromise(fs.createReadStream(finalPath, { highWaterMark: self.config.readingSpeed, }), fs.createWriteStream(path, { highWaterMark: self.config.writingSpeed, })).catch(error => { Config.debug ? console.log(error) : false; });
                        await self.deleteLocalFile(finalPath);
                    }
                }catch(error){ Config.debug ? console.log(error) : false; return false; }
            }

            return true;
        }catch(error){ Config.debug ? console.log(error) : false; return false; }
        return false;
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

    // Private function.
    // Searches files in a local directory.
    async searchLocalFiles(dirPath, query){
        if(dirPath.toString().trim() === "*"){
            dirPath = this.config.basePath;
        }

        const isValid = await this.doesLocalPathExists(dirPath);
        if(isValid){
            const isDir = await this.isLocalPathOfDirectory(dirPath);
            if(isDir){
                var files = [];
                if(dirPath.toString().trim() === this.config.basePath){
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
                    let fpath = ( dirPath === this.config.basePath ? file : (dirPath+(dirPath === "" ? "" : "/")+file) ); // getAllFilesOfLocalDirectoryRecursively returns full paths
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

    // Private function.
    // Returns values of a local file.
    async getLocalFile(fpath){
        const isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            const isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                const parsedPath = path.parse(fpath);
                const folderPath = parsedPath.dir.replace(this.config.basePath, "");
                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };

                return obj;
            }else{ return null; }
        }else{ return null; }
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

    // Private function.
    // Renames an local file.
    async renameLocalFile(path, newPath){
        const response = fs.promises.rename(path, newPath).then(async (msg) => {
            return true;
        }).catch(error => {
            return false;
        });

        return response;
    }

    // Private function.
    // Gets all files of a local directory recursively.
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

    // Private function.
    // Reads file to get it's unique encryption initialization vector stored with it in format of: (iv) in first 34 bytes.
    async readFileIV(path){
      const isValid = await this.doesLocalPathExists(path);
      if(isValid){
          const isFile = await this.isLocalPathOfFile(path);
          if(isFile){
              let contents = Buffer.from("");
              for await(let chunk of fs.createReadStream(path, { start: 0, end: 34, highWaterMark: 34, })){
                  contents = Buffer.concat([contents, chunk]);
              }

              if(!contents){ return null; }
              if(contents.length === 0){ return null; }

              let readable = contents.toString();
              let regex = /\(([^)]+)\)/;
              let match = readable.match(regex);

              if(!match){ return null; }
              if(match.length < 1){ return null; }
              if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'

              return match[1];
          }
      }

      return null;
    }
}

module.exports = FCLocalServerFileHandler;
