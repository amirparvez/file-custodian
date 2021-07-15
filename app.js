require("dotenv").config();
const FileCustodian = require("./lib/index.js");

const newFile = new FileCustodian.File({ url: "./images/image.png" });
console.log(newFile);