require("dotenv").config();
import Errors from './errors.js';

class Logger{
    constructor(){}

    log(message){
        process.env.FILECUSTODIAN_DEBUG && process.env.FILECUSTODIAN_DEBUG.toString().trim() === "true" ? console.log(message) : false;
    }

    error(abbr, args){
        if(process.env.FILECUSTODIAN_DEBUG && process.env.FILECUSTODIAN_DEBUG.toString().trim() === "true"){ throw Errors.find(x => {return x.abbr == abbr}).errorObj(args); };
    }
}

export default new Logger;
