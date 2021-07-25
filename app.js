const FileCustodian = require("./lib/index.js");
const { Sequelize, DataTypes, Model, Op } = require('sequelize');
const express = require("express");

import User from './lib/assets/models/User';

const custodian = new FileCustodian({ name: "Jack", });

const app = express();
app.use(express.static(__dirname + '/client'));

app.get('/', function(request, response){
    response.sendfile(__dirname + "/client/index.html");
});

app.post("/upload/", async function(request, response){
    await custodian.depository("s3-1").newFile({ request, folder: "images" }).then(files => {
        console.log("files", files);
    }).catch(error => {
        console.log(error);
    });

    response.end("uploaded");
});

app.get("/view/:folder/:name", async function(request, response){
    const file = await custodian.depository("ls-1").getFile({ name: `${request.params.name.split(".")[0]}`, ext: `${request.params.name.split(".")[1]}`, folder: `${request.params.folder}`, });
    if(file !== null){
        const { contents, contentType, readStream } = await file.getContents();
        if(contents !== null){
            response.writeHead(200, { 'Content-Type': contentType, });
            readStream.resume();
            contents.on('data', (data) => { response.write(data); });
            contents.on('end', () => { response.end(); });
        }
    }else{ response.end("Not found."); }
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});

start();

async function start(){
    /*await custodian.newDepository({
        name: "ls-1",
        type: "local-server",
        base_path: "D:/work/engineering/node/file custodian/depository",
        isDefault: true,
    });*/

    await custodian.newDepository({
        name: "s3-1",
        type: "aws-s3",
        bucket_name: "file-custodian",
        bucket_region: "ap-south-1",
        key: "viWRu4Bqgw5Z7oB5Peg7/FNSwF+iHJ6YaKwfeZ/a",
        key_id: "AKIA3MVO4ES35P6DKVGR",
        isDefault: true,
    });

    //await custodian.depository("ls-1").user(1);

    /*const sequelize = new Sequelize("nodejs2", "mainuser", "1234567890", {
        host: "localhost",
        port: "3306",
        dialect: "mariadb",
        timezone: "+00:00",
        dialectOptions: {
          connectTimeout: 90000,
          useUTC: true,
          timezone: "+00:00",
        },
    });

    const UserModel = User({s: sequelize});
    await UserModel.sync({ alter: true, });*/

    await custodian.depository("s3-1").newDatabase({
        host: "localhost",
        port: "3306",
        system: "mariadb",
        database: "nodejs",
        username: "mainuser",
        password: "1234567890",
        table_name: "fcfiles",
        proper_delete: false,
        //sequelize_instance: sequelize,
        //user_model: UserModel,
    });

    /*await custodian.depository("ls-1").newProtector({
      algorithm: "aes-256-ctr",
  });*/

    //console.log(await custodian.depository("s3-1"));

    await custodian.depository("s3-1").database().connect();
    await custodian.depository("s3-1").database().createTable();

    //const file = await custodian.depository("s3-1").getFile({ name: "abcd2", ext: "txt", });
    //console.log(file);

    //const newFile = await custodian.depository("s3-1").newFile({ name: "testing", ext: "txt", contents: "test", });
    //console.log(newFile);

    /*setTimeout(async function () {
        const userOne = await UserModel.findOne({
            where: {
                id: 1
            },
            include: { all: true },
        });

        console.log(await userOne.FCFiles);
    }, 1000);*/

    const files = await custodian.depository("s3-1").syncDatabase();
    //const files = await custodian.depository("s3-1").searchFiles({ folder: "images", /*query: "NAME_CONTAINS:infi",*/ });
    console.log(files);

    //const response = await files[0].rename("testing3");
    //const response = await files[0].delete();
    //console.log(response);

    //for(let file of files){
        //const model = await file.record();
    //}
}
