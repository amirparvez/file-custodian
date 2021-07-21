import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCFile from './file';

const fs = require("fs");
const path = require('path');
const crypto = require('crypto');

class FCFileProtector{
    constructor(config){
        this.config_provided = config;
        this.config = {
            algorithm: null,
        };

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileProtector", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            await this.setupKeys();

            Config.debug ? console.log("New file protector initialized") : false;
        }else{ Config.debug ? console.log("New file protector initialization failed") : false; }
    }

    async setupKeys(){
        try{
            if(Config.file_protector_key == null || Config.file_protector_iv == null || Config.file_protector_key.toString().trim() == "" || Config.file_protector_iv.toString().trim() == ""){
                var configjson = Config;
                configjson.file_protector_key = crypto.randomBytes(32).toString('hex');
                configjson.file_protector_iv = crypto.randomBytes(16).toString('hex');

                return await fs.promises.writeFile(__dirname+"/../config.json", JSON.stringify(configjson, null, 4)).then(message => {
                    return true;
                }).catch(error => {
                    return false;
                });
            }
        }catch(error){
            Config.debug ? console.log("Failed to setup file protector keys") : false;
        }

        return false;
    }

    async protect(data){
        try{
            if(data !== null){
                var cipher = crypto.createCipheriv(this.config.algorithm, Buffer.from(Config.file_protector_key, 'hex'), Buffer.from(Config.file_protector_iv, 'hex'), );
                var encrypted = await Buffer.concat([cipher.update(data), cipher.final()]);
                return encrypted;
            }
        }catch(error){
            return data;
        }

        return data;
    }

    async read(data){
        try{
            if(data !== null){
                var decipher = crypto.createDecipheriv(this.config.algorithm, Buffer.from(Config.file_protector_key, 'hex'), Buffer.from(Config.file_protector_iv, 'hex'), );
                var decrpyted = await Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
                return decrpyted;
            }
        }catch(error){
            return null;
        }

        return null;
    }
}

module.exports = FCFileProtector;
