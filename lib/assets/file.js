import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';

class FCFile{
    constructor(config){
        this.config_provided = config;
        this.config = {
            name: null,
            ext: null,
            data: null,
            folder: null,
            handler: null,
        };

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "File", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Config.debug ? console.log("New file initialized") : false;
        }else{ Config.debug ? console.log("New file initialization failed") : false; }
    }

    async delete(){
        return this.config.handler.deleteFile({ path: `${this.config.folder}/${this.config.name}.${this.config.ext}` });
    }
}

module.exports = FCFile;