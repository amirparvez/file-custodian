// Module for checking parameters passed to a function against that function's required parameters.

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
                        folder: Joi.string().allow("").default(""),
                        isEncrypted: Joi.boolean().default(false),
                        userId: Joi.number().allow(null).default(null),
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
                        type: Joi.string().valid('local-server', 'aws-s3', 'do-spaces', 'mega').required(),
                        basePath: Joi.string().optional().allow("").default(""),
                        bucketName: Joi.string().optional().when("type", {
                            is: "aws-s3",
                            then: Joi.required(),
                        }),
                        bucketRegion: Joi.string().optional().when("type", {
                            is: "aws-s3",
                            then: Joi.required(),
                        }),
                        key: Joi.string().optional().when("type", {
                            is: "aws-s3",
                            then: Joi.required(),
                        }),
                        keyId: Joi.string().optional().when("type", {
                            is: "aws-s3",
                            then: Joi.required(),
                        }),
                        email: Joi.string().optional().when("type", {
                            is: "mega",
                            then: Joi.required(),
                        }),
                        password: Joi.string().optional().when("type", {
                            is: "mega",
                            then: Joi.required(),
                        }),
                        readingSpeed: Joi.number().integer().default(16384),
                        writingSpeed: Joi.number().integer().default(16384),
                        encryptingSpeed: Joi.number().integer().default(16384),
                        userId: Joi.number().allow(null).default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "File_Creation",
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
                        folder: Joi.string().allow("").default(""),
                        contents: Joi.optional().when("request", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        isStream: Joi.boolean().default(false),
                        contentLength: Joi.number().integer().default(0).when("isStream", {
                            is: true,
                            then: Joi.required(),
                        }),
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
                        folder: Joi.string().allow("").default(""),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_RenameFile",
                schema:function(){
                    return Joi.object({
                        path: Joi.string(),
                        newPath: Joi.string(),
                        newName: Joi.string().when("newPath", {
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
                        folder: Joi.string().allow("").default(""),
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
                        folder: Joi.string().allow("").default(""),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_SearchFiles",
                schema: function(){
                    return Joi.object({
                        folder: Joi.string().allow("").default(""),
                        query: Joi.string().default(null),
                        forceRequestToS3: Joi.boolean().default(false),
                        forceRequestToMega: Joi.boolean().default(false),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "DatabaseHandler",
                schema: function(){
                    return Joi.object({
                        tableName: Joi.string().default("files"),
                        properDelete: Joi.boolean().default(false),
                        sequelizeInstance: Joi.allow(null).default(null),
                        userModel: Joi.allow(null).default(null),
                        system: Joi.string().valid("mysql", "mariadb", "postgres", "mongodb").required(),
                        url: Joi.string().when("system", {
                            is: "mongodb",
                            then: Joi.required(),
                        }),
                        host: Joi.string().when("system", {
                            not: "mongodb",
                            then: Joi.when("sequelizeInstance", {
                                is: null,
                                then: Joi.required(),
                            }),
                        }),
                        port: Joi.string().when("system", {
                            not: "mongodb",
                            then: Joi.when("sequelizeInstance", {
                                is: null,
                                then: Joi.required(),
                            }),
                        }),
                        database: Joi.string().when("system", {
                            not: "mongodb",
                            then: Joi.when("sequelizeInstance", {
                                is: null,
                                then: Joi.required(),
                            }),
                        }),
                        userName: Joi.string().when("system", {
                            not: "mongodb",
                            then: Joi.when("sequelizeInstance", {
                                is: null,
                                then: Joi.required(),
                            }),
                        }),
                        password: Joi.string().when("system", {
                            not: "mongodb",
                            then: Joi.when("sequelizeInstance", {
                                is: null,
                                then: Joi.required(),
                            }),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "MySQLHandler",
                schema: function(){
                    return Joi.object({
                        tableName: Joi.string().default("files"),
                        properDelete: Joi.boolean().default(false),
                        sequelizeInstance: Joi.allow(null).default(null),
                        userModel: Joi.allow(null).default(null),
                        system: Joi.string().valid("mysql", "mariadb", "postgres").required(),
                        host: Joi.string().when("sequelizeInstance", {
                            is: null,
                            then: Joi.required(),
                        }),
                        port: Joi.string().when("sequelizeInstance", {
                            is: null,
                            then: Joi.required(),
                        }),
                        database: Joi.string().when("sequelizeInstance", {
                            is: null,
                            then: Joi.required(),
                        }),
                        userName: Joi.string().when("sequelizeInstance", {
                            is: null,
                            then: Joi.required(),
                        }),
                        password: Joi.string().when("sequelizeInstance", {
                            is: null,
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "MongoDBHandler",
                schema: function(){
                    return Joi.object({
                        tableName: Joi.string().default("files"),
                        properDelete: Joi.boolean().default(false),
                        system: Joi.string().valid("mongodb").required(),
                        url: Joi.string().required(),
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
                        folder: Joi.string().allow("").default(""),
                        path: Joi.string().required(),
                        isEncrypted: Joi.boolean().default(false),
                        userId: Joi.number().allow(null).default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_DeleteModel",
                schema: function(){
                    return Joi.object({
                        id: Joi.optional(),
                        path: Joi.string().when("id", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        userId: Joi.number().allow(null).default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_GetAllModels",
                schema: function(){
                    return Joi.object({
                        folder: Joi.string().allow(null).allow("").default(null),
                        userId: Joi.number().allow(null).default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_UpdateModel",
                schema: function(){
                    return Joi.object({
                        id: Joi.optional(),
                        path: Joi.string().when("id", {
                            not: Joi.exist(),
                            then: Joi.required(),
                        }),
                        newName: Joi.string().optional(),
                        isEncrypted: Joi.boolean().optional(),
                        userId: Joi.number().allow(null).default(null),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "FileProtector",
                schema: function(){
                    return Joi.object({
                        algorithm: Joi.string().valid("aes-256-ctr").default("aes-256-ctr").required(),
                    }).options({ stripUnknown: true });
                },
            },
            {
                name: "Func_ReplaceFileContents",
                schema: function(){
                    return Joi.object({
                        file: Joi.required(),
                        newContents: Joi.required(),
                        readStream: Joi.required(),
                        doEncrypt: Joi.boolean().required(),
                        isStream: Joi.boolean().required(),
                        contentLength: Joi.number().integer().default(0).when("isStream", {
                            is: true,
                            then: Joi.required(),
                        }),
                    }).options({ stripUnknown: true });
                },
            },
        ];
    }

    async validate(options){
        if(options && typeof options == "object" && options.object && options.against){
            let response = null;
            try{
                response = await this.validateOptionsSchema.validateAsync(options);
            }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{ return {success: false, object: null,}; } }

            if(response.error === undefined){
                const schemaToCheckAgainst = this.schemas.find(x => {return x.name == options.against});
                if(schemaToCheckAgainst){
                    try{
                        const response2 = await schemaToCheckAgainst.schema().validateAsync(options.object);
                        return {success: true, object: response2,};
                    }catch(error){ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_vf"}).errorObj(options.against); }else{return {success: false, object: null,}} }
                }else{ if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_isn"}).errorObj; }else{return {success: false, object: null,}} }
            }
        }else { if(Config.debug){ throw Errors.find(x => {return x.abbr == "ov_io"}).errorObj; }else{return {success: false, object: null,}} }
    }
}

module.exports = new ObjectValidator;
