import Config from '../config.json';
import Logger from './logger.js';
import ObjectValidator from './objectvalidator.js';
import FCFile from './file.js';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

class FCFileProtector{
    constructor(config){
        this.config_provided = config;
        this.config = {
            algorithm: null,
        };

        this.init();
    }

    async init(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileProtector", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            await this.setupKeys();

            Logger.log("New file protector initialized");
        }else{ Logger.log("New file protector initialization failed"); }
    }

    // Private function.
    // Generate key if not provided in the config.json file.
    async setupKeys(){
        try{
            if(Config.file_protector_key == null || Config.file_protector_key.toString().trim() == ""){
                let configjson = Config;
                configjson.file_protector_key = crypto.randomBytes(32).toString('hex');

                // Update values in the config.json file.
                return await fs.promises.writeFile(__dirname+"/../config.json", JSON.stringify(configjson, null, 4)).then(message => {
                    return true;
                }).catch(error => {
                    return false;
                });
            }
        }catch(error){ Logger.log("Failed to setup file protector keys"); }

        return false;
    }

    // Encrypts data.
    async protect(data, iv){
        iv === null ? Logger.log(`Invalid IV`) : false;
        try{
            if(data !== null && iv !== null){
                let cipher = crypto.createCipheriv(this.config.algorithm, Buffer.from(Config.file_protector_key, 'hex'), Buffer.from(iv, 'hex'), );
                let encrypted = await Buffer.concat([cipher.update(data), cipher.final()]);
                return encrypted;
            }
        }catch(error){ Logger.log(error); }
        return data;
    }

    // Decrypts data.
    async read(data, iv){
        iv === null ? Logger.log(`Invalid IV`) : false;
        try{
            if(data !== null && iv !== null){
                let decipher = crypto.createDecipheriv(this.config.algorithm, Buffer.from(Config.file_protector_key, 'hex'), Buffer.from(iv, 'hex'), );
                let decrpyted = await Buffer.concat([decipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data)), decipher.final()]);
                return decrpyted;
            }
        }catch(error){ Logger.log(error); }
        return data;
    }
}

export default FCFileProtector;
