import Config from '../config.json';
import Errors from './errors';

const Joi = require('joi');

class ObjectValidator {
    constructor(){
        this.validateOptionsSchema = Joi.object({
            object: Joi.object().required(),
            against: Joi.string().required(),
        });

        this.schemas = [
            {
                name: "File", 
                schema: function(){
                    return Joi.object({
                        url: Joi.string().required(),
                    });
                },
            },
        ];
    }

    async validate(options){
        if(options && typeof options == "object" && options.object && options.against){
            var response = null;
            try{ 
                response = await this.validateOptionsSchema.validateAsync(options);
            }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{return false;} }

            if(response.error === undefined){
                var schemaToCheckAgainst = this.schemas.find(x => {return x.name == options.against});
                if(schemaToCheckAgainst){
                    try{
                        var response2 = await schemaToCheckAgainst.schema().validateAsync(options.object);
                        return true;
                    }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_vf"}).errorObj; }else{return false;} }
                }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_isn"}).errorObj; }else{return false;} }
            }
        }else { if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{return false;} }
    }
}

module.exports = new ObjectValidator;