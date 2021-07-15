import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './ObjectValidator';

class FCFile{
    constructor(config){
        this.configProvided = config;
        this.config = {
            url: null,
        };

        this.init();
    }

    async init(){
        var isConfigValid = await ObjectValidator.validate({ object: this.configProvided, against: "File", });

        if(isConfigValid){
            Config.debug ? console.log("New file created") : false;
        }else{ throw Errors.find(x => {return x.abbr == "ic"}).errorObj; }
    }
}

module.exports = FCFile;