import Logger from '../misc/logger.js';
import ObjectValidator from '../misc/objectvalidator.js';
import FileHandler from '../filehandler.js';

import fs from 'fs';
import path from 'path';
import stream from 'stream';
import crypto from 'crypto';
import util from 'util';

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
                        let folderPath = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", requestFileExt.toString().toLowerCase());
                        let fullFolderPath = await this.beautifyPath(folderPath, true);

                        await this.makeLocalDir(fullFolderPath);

                        let newLocalFileCreated = await this.makeLocalFile(`${fullFolderPath}${fullFolderPath == "" ? "" : "/"}${requestFileName}`, finalContents, readStream, doEncrypt, isStream, contentLength, false);
                        if(newLocalFileCreated === true){
                            if(doEncrypt === true){ didEncrypt = true; }

                            let obj = { name: requestFileName.replace("."+requestFileExt, ""), ext: requestFileExt, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                            let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                            Logger.log("New LSfile created");
                            newFCFile ? FCFiles.push(newFCFile) : false;
                        }
                    }else{ }
                }

                return FCFiles.length > 0 ? FCFiles : null;
            }else{
                let folderPath = validateConfig.object.folder.replace("FILE_EXTENSION_WISE", validateConfig.object.ext.toString().toLowerCase());
                let fullFolderPath = await this.beautifyPath(folderPath, true);

                await this.makeLocalDir(fullFolderPath);

                let finalContents = validateConfig.object.contents;
                let doEncrypt = false;
                let didEncrypt = false;
                if(this.file_protector !== null && validateConfig.object.isEncrypted === false){
                    // If a file protector is assigned & passed value of isEncrypted is not true, encrypt the contents.
                    doEncrypt = true;
                    // Encrypt contents while writing the file.
                }

                let newLocalFileCreated = await this.makeLocalFile(
                    `${fullFolderPath}${fullFolderPath == "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}`,
                    finalContents,
                    validateConfig.object.readStream !== null ? validateConfig.object.readStream : validateConfig.object.isStream === true ? finalContents : null,
                    doEncrypt,
                    validateConfig.object.isStream,
                    validateConfig.object.isStream === true ? validateConfig.object.contentLength : finalContents.length,
                    false
                );

                if(newLocalFileCreated === true){
                    if(doEncrypt === true){ didEncrypt = true; }

                    let obj = { name: validateConfig.object.name, ext: validateConfig.object.ext, folder: folderPath, handler: self, isEncrypted: validateConfig.object.isEncrypted === true ? true : didEncrypt, };
                    let newFCFile = await self.newFCFile(obj); // Wrap file values in a FCFile instance.

                    Logger.log("New LSfile created");
                    return newFCFile;
                }

                Logger.log("New LSfile creation failed");
            }
        }else{ Logger.log("New LSfile creation failed"); }

        return null;
    }

    // Private function.
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

            let response = await this.deleteLocalFile(pathToFile);
            if(response){ Logger.log("LSfile deleted"); return true; }

            Logger.log("LSfile deletion failed");
        }else{ Logger.log("LSfile deletion failed"); }

        return false;
    }

    // Private function.
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

            let response = await this.renameLocalFile(pathToFile, newPath);
            if(response){ Logger.log("LSfile renamed"); return true; }

            Logger.log("LSfile renaming failed");
        }else{ Logger.log("LSfile renaming failed"); }

        return false;
    }

    // Gets a file from depository.
    async getFile(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_GetFile", });
        if(validateConfig.success){
            let file = null;
            if(validateConfig.object.id !== undefined && validateConfig.object.id !== null){
                if(this.database_handler){
                    const exists = await this.database_handler.getModel({ id: validateConfig.object.id, userId: this.config.userId, });
                    if(exists){
                        let fullPathToFile = await this.beautifyPath(exists.path, true);
                        file = await this.getLocalFile(fullPathToFile);
                    }
                }
            }else{
                let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                    validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
                );

                let fullPathToFile = await this.beautifyPath(pathToFile, true);
                file = await this.getLocalFile(fullPathToFile);
            }

            if(file){ return await self.newFCFile({...file, handler: self, isEncrypted: false,}); }
        }

        return null;
    }

    // Private function.
    // Copies a file to a folder within this depository.
    async copyFile(options){
        const self = this;
        const fsn = await this.getFileSchemaNameFromFH();
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_CopyFile", });

        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let newPath = validateConfig.object.newPath ? validateConfig.object.newPath : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folderName !== null ? `${validateConfig.object.folderName}${validateConfig.object.folderName === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return null;
            }

            pathToFile = await this.beautifyPath(pathToFile, true);
            newPath = await this.beautifyPath(newPath, true);

            await this.makeLocalDir(path.dirname(newPath));

            let response = await this.copyLocalFile(pathToFile, newPath);
            if(response){
                Logger.log(`${fsn} copied`);

                let file = await this.getLocalFile(newPath);
                if(file){ return await self.newFCFile({...file, handler: self, isEncrypted: validateConfig.object.isEncrypted, }); }

                return null;
            }

            Logger.log(`${fsn} copying failed`);
        }else{ Logger.log(`${fsn} copying failed`); }

        return null;
    }

    // Private function.
    // Moves a file to a folder within this depository.
    async moveFile(options){
        const self = this;
        const fsn = await this.getFileSchemaNameFromFH();
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_MoveFile", });

        if(validateConfig.success){
            let pathToFile = validateConfig.object.path ? validateConfig.object.path : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folder !== null ? `${validateConfig.object.folder}${validateConfig.object.folder === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            let newPath = validateConfig.object.newPath ? validateConfig.object.newPath : (
                validateConfig.object.name && validateConfig.object.ext && validateConfig.object.folderName !== null ? `${validateConfig.object.folderName}${validateConfig.object.folderName === "" ? "" : "/"}${validateConfig.object.name}.${validateConfig.object.ext}` : null
            );

            if(pathToFile == null || newPath == null){
                return null;
            }

            let fullPathToFile = await this.beautifyPath(pathToFile, true);
            let fullNewPath = await this.beautifyPath(newPath, true);

            await this.makeLocalDir(path.dirname(fullNewPath));

            let response = await this.copyLocalFile(fullPathToFile, fullNewPath);
            if(response){
                let response2 = await this.deleteLocalFile(fullPathToFile);
                if(response2 === true){
                    Logger.log(`${fsn} moved`);

                    if(this.database_handler){
                        const exists = await this.database_handler.getModel({ path: pathToFile, userId: this.config.userId, });
                        if(exists !== null && exists !== undefined){
                            const response3 = await this.database_handler.updateModel({ path: pathToFile, newPath, userId: this.config.userId, });
                            if(response3 === true){
                                let file = await this.getLocalFile(fullNewPath);
                                if(file){
                                    return await self.newFCFile({...file, handler: self, isEncrypted: validateConfig.object.isEncrypted, });
                                }
                            }
                        }
                    }

                    return null;
                }
            }

            Logger.log(`${fsn} moving failed`);
        }else{ Logger.log(`${fsn} moving failed`); }

        return null;
    }

    // Searches file in depository.
    async searchFiles(options){
        const self = this;
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_SearchFiles", });
        if(validateConfig.success){
            let pathToFile = validateConfig.object.folder;

            let files = await this.searchLocalFiles(pathToFile.toString().trim() === "*" ? "*" : await this.beautifyPath(pathToFile, true), validateConfig.object.query);
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
        return await this.getLocalFileSize(this.config.basePath == "" ? path : path.startsWith(this.config.basePath) ? path : `${this.config.basePath}/${path}`); // This check is needed for local server
    }

    // Syncs all files in the depository to the connected database.
    async syncDatabase(){
        try{
            let files = await this.getAllFilesOfLocalDirectoryRecursively(this.config.basePath);

            let filesWithInformation = [];
            for(let file of files){
                try{
                    let data = await this.getLocalFile(file);
                    let FCFile = await this.newFCFile({...data, handler: this, isEncrypted: false,}); // Wrap file values in a FCFile instance.
                    FCFile ? await FCFile.record(false) : false; // Create a file entry in database if it does not exists.
                    FCFile ? filesWithInformation.push(FCFile) : false;
                }catch(error){continue;}
            }

            return filesWithInformation;
        }catch(error){ Logger.log(error); }

        return [];
    }

    // Private function.
    // Replaces file contents in depository.
    async replaceFileContents(options){
        const validateConfig = await ObjectValidator.validate({ object: options, against: "Func_ReplaceFileContents", });
        try{
            if(validateConfig.success){
                let beautifiedPath = await this.beautifyPath(validateConfig.object.file.config.folder, true);
                let filePath = `${beautifiedPath}${beautifiedPath == "" ? "" : "/"}${validateConfig.object.file.config.name}.${validateConfig.object.file.config.ext}`;
                return await this.makeLocalFile(filePath, validateConfig.object.newContents, validateConfig.object.readStream, validateConfig.object.doEncrypt, validateConfig.object.isStream, validateConfig.object.contentLength, true);
            }else{ return false; }
        }catch(error){ Logger.log(error); }

        return false;
    }

    // Private function.
    // Returns contents of a file in depository.
    async getFileContents(file, returnDecryptStreamSeparately = false){
        try{
            let beautifiedPath = await this.beautifyPath(file.config.folder, true);
            let filePath = `${beautifiedPath}${beautifiedPath === "" ? "" : "/"}${file.config.name}.${file.config.ext}`;

            return await this.getLocalFileContents(filePath, file.config.isEncrypted, file.config.iv);
        }catch(error){ Logger.log(error); }

        return { contents: null, contentType: null, contentLength: 0, readStream: null,  };
    }

    /* Core/Helping/Util functions */

    async setup(){
        if(this.config.basePath == ""){ return true; }
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
        // readStream is null when isStream is false.

        let self = this;
        try{
            var contentStream = contents;
            const uniqueIV = crypto.randomBytes(16).toString('hex');

            if(isStream === false){
                const readData = doEncrypt === true ? Buffer.concat([Buffer.from(`(${uniqueIV})`), Buffer.isBuffer(contents) ? contents : Buffer.from(contents)]) : Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
                contentStream = self.createDataReadStream(readData, self.config.encryptingSpeed);
            }

            try{ contentStream.pause(); }catch(error){ Logger.log(error); }
            try{ readStream.pause(); }catch(error){ Logger.log(error); }

            contentStream.on('end', function(){ contentStream.destroy(); });
            contentStream.on('error', function(error){ Logger.log(error); contentStream.destroy(); });

            let random = Math.floor(Math.random()*1000000000000000000000)+100000000000000000000;
            let finalPath = isReplacing === true ? `${self.config.basePath}/temp/temp-${random}.temp` : path;

            if(isReplacing === true){ await self.makeLocalDir(`${self.config.basePath}/temp`); }

            if(doEncrypt === true){
                // This condition is true, when making a new encrypted file or when replacing contents of a decrypted file with encrypted ones.

                // WHEN contents IS A STREAM (isStream === true) contentLength does not needs to be increased for encryptStream by 34 for IV since uniqueIV is not pushed into contentStream instead it's pushed into writeStream...
                // ...therefore it will not be processed in the encryptStream, due to which encrypt stream will only need to the length of contents without IV length.
                let encryptStream = self.createEncryptStream(self.config.encryptingSpeed, contentStream, contentLength+(isStream === true ? 0 : 34), uniqueIV);
                let writeStream = fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.encryptingSpeed, });
                if(isStream === true){
                    // If contents is a stream, contentStream is set to contents and a manual creation of contentStream is not done therefore it is required to pass the uniqueIV.
                    writeStream.write(`(${uniqueIV})`);
                }

                try{ contentStream.resume(); }catch(error){ Logger.log(error); }
                try{ readStream.resume(); }catch(error){ Logger.log(error); }

                await pipelineWithPromise(contentStream, encryptStream, writeStream).catch(error => { Logger.log(error); });
            }else{
                if(isReplacing === true){
                    // doEncrypt false and isReplacing true proves that an encrypted file is being replaced, in other words, a file is being decrypted.
                    // contentStream is a pipeline passed from getLocalFileContents()
                    // isStream is TRUE

                    try{ contentStream.resume(); }catch(error){ Logger.log(error); }
                    try{ readStream.resume(); }catch(error){ Logger.log(error); }

                    await pipelineWithPromise(contentStream, fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.writingSpeed, })).catch(error => { Logger.log(error); });
                }else{
                    // contentStream is a read stream

                    try{ contentStream.resume(); }catch(error){ Logger.log(error); }
                    try{ readStream.resume(); }catch(error){ Logger.log(error); }

                    await pipelineWithPromise(contentStream, fs.createWriteStream(finalPath, {flags: 'a', highWaterMark: self.config.writingSpeed, })).catch(error => { Logger.log(error); });
                }
            }

            if(isReplacing === true){
                try{
                    let doesTempFileExists = await self.doesLocalPathExists(finalPath);
                    if(doesTempFileExists){
                        await pipelineWithPromise(fs.createReadStream(finalPath, { highWaterMark: self.config.readingSpeed, }), fs.createWriteStream(path, { highWaterMark: self.config.writingSpeed, })).catch(error => { Logger.log(error); });
                        await self.deleteLocalFile(finalPath);
                    }
                }catch(error){ Logger.log(error); return false; }
            }

            return true;
        }catch(error){ Logger.log(error); }
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
                    // gets full paths, basePath + folder + name
                    files = await this.getAllFilesOfLocalDirectoryRecursively(dirPath);
                }else{
                    // gets only names
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
                            return path.extname(file).replace(".", "").toLowerCase() == queryParam;
                        });
                    }else{
                        if(queryType === "name"){
                            filteredFiles = files.filter(file => {
                                let parse = path.parse(file);
                                return parse.base.replace(parse.ext, "").toLowerCase() == queryParam;
                            });
                        }else{
                            if(queryType === "name_contains"){
                                filteredFiles = files.filter(file => {
                                    let parse = path.parse(file);
                                    return parse.base.replace(parse.ext, "").toLowerCase().includes(queryParam);
                                });
                            }else{ filteredFiles = files; }
                        }
                    }
                }else{ filteredFiles = files; }

                let finalFiles = [];
                for(let file of filteredFiles){
                    let fpath = ( dirPath === this.config.basePath ? file : (dirPath+(dirPath === "" ? "" : "/")+file) ); // getAllFilesOfLocalDirectoryRecursively returns full paths
                    const fileObj = await this.getLocalFile(fpath); // Get data for each local file.
                    if(fileObj !== null){
                        finalFiles.push(fileObj);
                    }
                }

                return finalFiles;
            }
        }

        return [];
    }

    // Private function.
    // Returns values of a local file.
    async getLocalFile(fpath){
        const isValid = await this.doesLocalPathExists(fpath);
        if(isValid){
            const isFile = await this.isLocalPathOfFile(fpath);
            if(isFile){
                const parsedPath = path.parse(fpath);
                let folderPath = this.config.basePath == "" ? parsedPath.dir : parsedPath.dir.replace(this.config.basePath, ""); // Remove basePath
                if(folderPath.charAt(0) === "/"){ folderPath = folderPath.substring(1); } // Remove forward slash

                const obj = { name: parsedPath.name, ext: parsedPath.ext.replace(".", ""), folder: folderPath, };
                return obj;
            }
        }

        return null;
    }

    // Private function.
    // Deletes a local file.
    async deleteLocalFile(path){
        const response = fs.promises.rm(path).then(async (msg) => {
            return true;
        }).catch(error => {
            Logger.log(error);
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
            Logger.log(error);
            return false;
        });

        return response;
    }

    // Private function.
    // Copies a local file.
    async copyLocalFile(filePath, newPath){
        const response = await fs.promises.copyFile(filePath, newPath).then(data => {
            return true;
        }).catch(error => {
            Logger.log(error);
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
                        const filesOfCurrentDir = await this.getAllFilesOfLocalDirectoryRecursively(`${path}/${item}`);
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
        }catch(error){ Logger.log(error); }

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
              if(match[1].length < 32){ return null; } // 32 = len of hex, +2 for '(' hex ')'. < 32 for match

              return match[1];
          }
      }

      return null;
    }
}

export default FCLocalServerFileHandler;
