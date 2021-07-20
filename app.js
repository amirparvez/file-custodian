require("dotenv").config();
const FileCustodian = require("./lib/index.js");
const express = require("express");

const custodian = new FileCustodian({ name: "Jack", });
const crypto = require('crypto');

const app = express();
app.use(express.static(__dirname + '/client'));

app.get('/', function(request, response){
    response.sendfile(__dirname + "/client/index.html");
});

app.post("/upload/", async function(request, response){
    await custodian.dep("ls-1").newFile({ request, folder: "/encrypted" }).then(files => {
        console.log("files", files);
    }).catch(error => {
        console.log(error);
    });

    response.end("uploaded");
});

app.get("/view/:folder/:name", async function(request, response){
    var file = await custodian.dep("ls-1").getFile({ name: `${request.params.name.split(".")[0]}`, ext: `${request.params.name.split(".")[1]}`, folder: `/${request.params.folder}`, });
    if(file !== null){
        var image = Buffer.from(file.config.data, 'base64');
        response.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': image.length,
        });

        response.end(image);
    }else{ response.end("Not found."); }
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});

start();

async function start(){
    await custodian.newDepository({
        name: "ls-1",
        type: "local-server",
        base_path: "D:/work/engineering/node/file custodian/depository",
        isDefault: true,
    });

    await custodian.dep("ls-1").newDatabase({
        host: "localhost",
        port: "3306"/*"5432"*/,
        system: "mariadb"/*"postgres"*/,
        database: "nodejs",
        username: "mainuser",
        password: "1234567890",
        table_name: "fcfiles",
        proper_delete: false,
    });

    //const iv = crypto.randomBytes(16).toString('hex');
    //const key = crypto.randomBytes(32).toString('hex');

    await custodian.dep("ls-1").newProtector({
      algorithm: "aes-256-ctr",
      key: "ac9f2fed5461ae2d6d0c9bdf95c1d79c0e90e2bdeeae9fd1b48eac0892fce299",
      initialization_vector: "386d7bf8cfd7b744f0eb9aa455ee5c11",
    });

    console.log(await custodian.dep("ls-1"));

    await custodian.dep("ls-1").db().init();
    //await custodian.dep("ls-1").db().createTable();
    //var newFile = await custodian.dep("ls-1").newFile({ name: "testing", ext: "txt", folder: "/encrypted", data: "test", });
    //console.log(newFile);
    //var files = await custodian.dep("ls-1").syncDB();
    //var files = await custodian.dep("ls-1").searchFiles({ folder: "/encrypted", /*query: "NAME_CONTAINS:infi",*/ });
    //console.log(files);

    //var response = await files[0].rename("testing3");
    //var response = await files[0].delete();
    //console.log(response);

    //for(var file of files){
        //var model = await file.createModel();
    //}
}
