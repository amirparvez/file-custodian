require("dotenv").config();
const FileCustodian = require("./lib/index.js");

const custodian = new FileCustodian({ name: "Jack", });
setTimeout(async () => {
    await custodian.newFH({ name: "ls-1", isDefault: true, depository: "local-server", base_path: "D:/node/file custodian/depository/", });
    await custodian.newFH({ name: "s3-1", isDefault: false, depository: "aws-s3" });

    setTimeout(async () => {
        console.log(custodian);
    }, 1000);
}, 1000);