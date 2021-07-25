import Config from '../config.json';
import Errors from './errors';

import ObjectValidator from './objectvalidator';

class FCMongoDBHandler{
    constructor(config){
        this.config_provided = config;
        this.config = {
            host: null,
            port: null,
            database: null,
            username: null,
            password: null,
            table_name: null,
        };
    }

    async connect(){
        const validateConfig = await ObjectValidator.validate({ object: this.config_provided, against: "MongoDBHandler", });

        if(validateConfig.success){
            this.config = validateConfig.object;

            Config.debug ? console.log("New FCMongoDBHandler initialized") : false;
        }else{ Config.debug ? console.log("New FCMongoDBHandler initialization failed") : false; }
    }
}

module.exports = FCMongoDBHandler;
