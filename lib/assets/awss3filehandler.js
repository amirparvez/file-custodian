import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';
import FileHandler from './filehandler';

class FCAWSS3FileHandler extends FileHandler{
    constructor(parentParams){
        super(parentParams);
    }

    async newFile(options){
        var validateConfig = await ObjectValidator.validate({ object: options, against: "S3File", });

        if(validateConfig.success){
            Config.debug ? console.log("New S3File created") : false;
        }else{ Config.debug ? console.log("New S3File creation failed") : false; }
    }
}

module.exports = FCAWSS3FileHandler;