require('dotenv').config();

const presets = ["@babel/preset-env"];
const plugins = [];

if(process.env["ENV"] === "dev"){
    plugins.push("@babel/plugin-transform-runtime");
}

module.exports = { presets, plugins };
