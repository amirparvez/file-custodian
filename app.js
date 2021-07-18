require("dotenv").config();
const FileCustodian = require("./lib/index.js");
const express = require("express");

const custodian = new FileCustodian({ name: "Jack", });

const app = express();
app.use(express.static(__dirname + '/client'));

app.get('/', function(request, response){
    response.sendfile(__dirname + "/client/index.html");
});

app.post("/upload/", async function(request, response){
    await custodian.dep("ls-1").newFile({ request, folder: "/images/FILE_EXTENSION_WISE" }).then(files => {
        console.log("files", files);
    }).catch(error => {
        console.log(error);
    });

    response.end("uploaded");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});

start();

async function start(){
    await custodian.newDepository({ 
        name: "ls-1", 
        type: "local-server", 
        base_path: "D:/node/file custodian/depository",
        isDefault: true,
    });

    await custodian.dep("ls-1").newDatabase({ 
        host: "localhost", 
        port: "3306", 
        system: "mariadb",
        database: "nodejs", 
        username: "mainuser", 
        password: "1234567890",
        table_name: "fcfiles",
        properY_delete: false,
    });
    
    await custodian.dep("ls-1").db().init();
    //await custodian.dep("ls-1").db().createTable();
    //var files = await custodian.dep("ls-1").syncDB();
    //var files = await custodian.dep("ls-1").searchFiles({ folder: "/", /*query: "NAME_CONTAINS:infi",*/ });
    //console.log(files);

    //var response = await files[0].rename("testing3");
    //console.log(response);

    //for(var file of files){
    //    var model = await file.createModel();
    //}
}