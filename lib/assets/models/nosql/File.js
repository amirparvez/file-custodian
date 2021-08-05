import mongoose from 'mongoose';
import { Schema } from 'mongoose';

const fileSchema = new Schema({
    name: { type: String, required: true, },
    folder: { type: String, default: "", },
    path: { type: String, required: true, },
    extension: { type: String, required: true, },
    size: { type: Number, default: 0, },
    userId: { type: Number, default: null, },
    isEncrypted: { type: Boolean, default: false, },
    isDeleted: { type: Boolean, default: false, },
    deleted_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

fileSchema.method('renameId', function(){
   const { __v, _id, ...object } = this.toObject();
   object.id = _id.toString();
   return object;
});

function newFile(config){
    const tableName = config.t;

    const model = mongoose.model('File', fileSchema, tableName);
    return model;
}

export default newFile;
