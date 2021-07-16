import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FCFile from './file';

const fs = require("fs");
const multiparty = require('multiparty');

class FCFileHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            depository: null,
            base_path: null,
        };

        this.init();
    }

    async init(){
        var validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "FileHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            if(this.config.depository == "local-server"){
                if(!fs.existsSync(this.config.base_path)){
                    await fs.promises.mkdir(this.config.base_path, { recursive: true }).then(msg => {
                        console.log(msg);
                    }).catch(error => {
                        console.log(error);
                    });
                }
            }

            Config.debug ? console.log("New file handler initialized") : false;
        }else{ Config.debug ? console.log("New file handler initialization failed") : false; }
    }

    async newFCFile(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "File", });

        if(validateConfig.success){
            var newFile = new FCFile(options);
            Config.debug ? console.log("New FCFile created") : false;

            return newFile;
        }else{ Config.debug ? console.log("New FCFile creation failed") : false; return null; }

        return null;
    }

    async getFilesFromHttpRequest(request){
        if(request){
            try{
                var form = new multiparty.Form();
                return form.parse(request, function(error, fields, files){
                    return files;
                });
            }catch(error){
                Config.debug ? console.log("Extraction of files from HTTP request failed") : false; 
                return [];
            }
        }else{ Config.debug ? console.log("Extraction of files from HTTP request failed") : false; return []; }
    }
}

module.exports = FCFileHandler;