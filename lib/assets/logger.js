import Config from '../config.json';
import Errors from './errors.js';

class Logger{
    constructor(){}

    log(message){
        Config.debug ? console.log(message) : false;
    }

    error(abbr){
        if(Config.debug){ throw Errors.find(x => {return x.abbr == abbr}).errorObj(); };
    }
}

export default new Logger;
