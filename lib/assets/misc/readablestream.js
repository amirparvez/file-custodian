import Logger from './logger.js';
import stream from 'stream';

class FCReadableStream extends stream.Readable {
    constructor(options){
        super(options);
        this.data = Buffer.isBuffer(options._fcData) ? options._fcData : Buffer.from(options._fcData);
        this.dataRead = 0;
        this.dataToBeRead = this.data.length;

        Logger.log({ dataTotal: this.data.length, dataRead: this.dataRead, dataToBeRead: this.dataToBeRead });
    }

    _read(highWaterMark){
        let self = this;
        if(self.dataToBeRead <= 0){
            self.push(null);
        }else{
            let dataToReturn = self.data.slice(self.dataRead, highWaterMark);
            self.dataRead = self.dataRead + dataToReturn.length;
            self.dataToBeRead = self.dataToBeRead - dataToReturn.length;
            self.push(dataToReturn);
        }

        Logger.log({ dataTotal: self.data.length, dataRead: self.dataRead, dataToBeRead: self.dataToBeRead });
    }
}

export default FCReadableStream;
