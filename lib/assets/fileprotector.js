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
            key: null,
            initialization_vector: null,
        };

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileProtector", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Config.debug ? console.log("New file protector initialized") : false;
        }else{ Config.debug ? console.log("New file protector initialization failed") : false; }
    }

    async protect(data){
        try{
            if(data !== null){
                var cipher = crypto.createCipheriv(this.config.algorithm, Buffer.from(this.config.key, 'hex'), Buffer.from(this.config.initialization_vector, 'hex'), );
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
                var decipher = crypto.createDecipheriv(this.config.algorithm, Buffer.from(this.config.key, 'hex'), Buffer.from(this.config.initialization_vector, 'hex'), );
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
