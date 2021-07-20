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
                        name: Joi.string().required(),
                        ext: Joi.string().required(),
                        folder: Joi.string().default("/"),
                        data: Joi.required(),
                        isEncrypted: Joi.boolean().default(false),
                        handler: Joi.required(),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Custodian",
                schema: function(){
                    return Joi.object({
                        name: Joi.string().required(),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "FileHandler",
                schema: function(){
                    return Joi.object({
                        type: Joi.string().valid('local-server','remote-server', 'aws-s3', 'google-cloud', 'do-space').required(),
                        base_path: Joi.string().when("type", {
                            is: Joi.string().valid('local-server', 'remote-server'),
                            then: Joi.required(),
                            otherwise: Joi.string().optional().allow(null).default(null),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "LSFile",
                schema: function(){
                    return Joi.object({
                        request: Joi.optional(),
                        isEncrypted: Joi.boolean().default(false),
                        name: Joi.string().when("request", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        ext: Joi.string().when("request", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        folder: Joi.string().default("/"),
                        data: Joi.optional().when("request", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "S3File",
                schema: function(){
                    return Joi.object({
                        name: Joi.string().required(),
                        isEncrypted: Joi.boolean().default(false),
                        ext: Joi.string().required(),
                        folder: Joi.string().default("/"),
                        data: Joi.required(),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_DeleteFile",
                schema:function(){
                    return Joi.object({
                        path: Joi.string(),
                        name: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        ext: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        folder: Joi.string().default("/").when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_RenameFile",
                schema:function(){
                    return Joi.object({
                        path: Joi.string(),
                        new_path: Joi.string(),
                        new_name: Joi.string().when("new_path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        name: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        ext: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        folder: Joi.string().default("/").when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_GetFile",
                schema: function(){
                    return Joi.object({
                        path: Joi.string(),
                        name: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        ext: Joi.string().when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        folder: Joi.string().default("/").when("path", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_SearchFiles",
                schema: function(){
                    return Joi.object({
                        folder: Joi.string().default("/"),
                        query: Joi.string().default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "DatabaseHandler",
                schema: function(){
                    return Joi.object({
                        system: Joi.string().valid("mysql", "mariadb", "postgres", "mongodb").required(),
                        host: Joi.string().required(),
                        port: Joi.string().required(),
                        database: Joi.string().required(),
                        username: Joi.string().required(),
                        password: Joi.string().required(),
                        table_name: Joi.string().default("files"),
                        proper_delete: Joi.boolean().default(false),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "MySQLHandler",
                schema: function(){
                    return Joi.object({
                        system: Joi.string().valid("mysql", "mariadb", "postgres").required(),
                        host: Joi.string().required(),
                        port: Joi.string().required(),
                        database: Joi.string().required(),
                        username: Joi.string().required(),
                        password: Joi.string().required(),
                        table_name: Joi.string().default("files"),
                        proper_delete: Joi.boolean().default(false),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "MongoDBHandler",
                schema: function(){
                    return Joi.object({
                        system: Joi.string().valid("mongodb").default("mongodb"),
                        host: Joi.string().required(),
                        port: Joi.string().required(),
                        database: Joi.string().required(),
                        username: Joi.string().required(),
                        password: Joi.string().required(),
                        table_name: Joi.string().default("files"),
                        proper_delete: Joi.boolean().default(false),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_NewModel",
                schema: function(){
                    return Joi.object({
                        name: Joi.string().required(),
                        ext: Joi.string().required(),
                        size: Joi.number().integer().required(),
                        folder: Joi.string().default("/"),
                        path: Joi.string().required(),
                        isEncrypted: Joi.boolean().default(false),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_DeleteModel",
                schema: function(){
                    return Joi.object({
                        id: Joi.string(),
                        path: Joi.string().when("id", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_UpdateModel",
                schema: function(){
                    return Joi.object({
                        id: Joi.string(),
                        path: Joi.string().when("id", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        new_name: Joi.string().required(),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "FileProtector",
                schema: function(){
                    return Joi.object({
                        key: Joi.required(),
                        algorithm: Joi.string().valid("aes-256-ctr").default("aes-256-ctr").required(),
                        initialization_vector: Joi.required(),
                    }).options({ stripUnknown: true });
                },
            },
        ];
    }

    async validate(options){
        if(options && typeof options == "object" && options.object && options.against){
            var response = null;
            try{
                response = await this.validateOptionsSchema.validateAsync(options);
            }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{ return {success: false, object: null,}; } }

            if(response.error === undefined){
                var schemaToCheckAgainst = this.schemas.find(x => {return x.name == options.against});
                if(schemaToCheckAgainst){
                    try{
                        var response2 = await schemaToCheckAgainst.schema().validateAsync(options.object);
                        return {success: true, object: response2,};
                    }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_vf"}).errorObj; }else{return {success: false, object: null,}} }
                }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_isn"}).errorObj; }else{return {success: false, object: null,}} }
            }
        }else { if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{return {success: false, object: null,}} }
    }
}

module.exports = new ObjectValidator;
