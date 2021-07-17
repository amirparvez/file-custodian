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
    await custodian.fh("ls-1").newFile({ request, /*folder: "/FILE_EXTENSION_WISE"*/ }).then(files => {
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
    await custodian.newFH({ name: "ls-1", isDefault: true, depository: "local-server", base_path: "D:/node/file custodian/depository/", });
    //await custodian.newFH({ name: "s3-1", isDefault: false, depository: "aws-s3" });

    //var file = await custodian.getFile({ name: "newname", ext: "jpeg", folder: "jpeg" /*path: "/jpeg/oldtest.jpeg"*/ });
    //console.log(file);

    //await file.rename("newname");
    //await file.delete();

    //var files = await custodian.fh("ls-1").searchFiles({ folder: "/", query: "EXTENSION:PNG", });
    //console.log(files);

    /*for(var file of files){
        await file.delete();
    }*/
}