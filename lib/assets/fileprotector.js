require("dotenv").config();
import Logger from './misc/logger.js';
import ObjectValidator from './misc/objectvalidator.js';
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
            let isKeyProvided = await this.checkKey();
            if(isKeyProvided === true){
                Logger.log("New file protector initialized");
            }else{ Logger.log("New file protector initialization failed"); }
        }else{ Logger.log("New file protector initialization failed"); }
    }

    // Private function.
    async checkKey(){
        return !process.env.FILECUSTODIAN_PROTECTOR_KEY || process.env.FILECUSTODIAN_PROTECTOR_KEY.toString().trim() === "null" || process.env.FILECUSTODIAN_PROTECTOR_KEY.toString().trim() === "" ? false : true;
    }

    // Encrypts data.
    async protect(data, iv){
        iv === null ? Logger.log(`Invalid IV`) : false;
        try{
            if(data !== null && iv !== null){
                let cipher = crypto.createCipheriv(this.config.algorithm, Buffer.from(process.env.FILECUSTODIAN_PROTECTOR_KEY.toString().trim(), 'hex'), Buffer.from(iv, 'hex'), );
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
                let decipher = crypto.createDecipheriv(this.config.algorithm, Buffer.from(process.env.FILECUSTODIAN_PROTECTOR_KEY.toString().trim(), 'hex'), Buffer.from(iv, 'hex'), );
                let decrpyted = await Buffer.concat([decipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data)), decipher.final()]);
                return decrpyted;
            }
        }catch(error){ Logger.log(error); }
        return data;
    }
}

export default FCFileProtector;
