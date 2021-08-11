const yargs = require('yargs');
const spawn = require('child_process').spawn;

const options = { "cwd": __dirname, shell: true };
const files = [
    { n: "all", path: "" },
    { n: "custodian", path: "/1.custodian.test.js" },
    { n: "depository", path: "/2.depository.test.js" },
    { n: "database", path: "/3.database.test.js" },
    { n: "protector", path: "/4.protector.test.js" },
    { n: "local", path: "/5.localserver.test.js" },
    { n: "s3", path: "/6.amazons3.test.js" },
    { n: "b2", path: "/7.backblazeb2.test.js" },
    { n: "spaces", path: "/8.digitaloceanspaces.test.js" },
    { n: "mega", path: "/9.mega.test.js" }
];

yargs.command({
    command: 'run',
    describe: 'Run test/s',
    handler: async argv => {
        let file = files.find(x => (x.n == argv.n));
        let command = "npx jest";
        let path = file && file.path !== undefined && file !== null ? `./tests${file.path}` : null;
        let args = [];

        if(path !== null){
            if(argv.d && argv.d.toString() == 'true'){ args = [...args, path, '--verbose', '--detectOpenHandles', '--colors']; }else{ args = [...args, path, '--silent', '--colors']; }

            return new Promise((resolve, reject) => {
                console.log('[Tester] Testing...');
                const process = spawn(command, args, options);
                process.stdout.setEncoding('utf8');
                process.stderr.setEncoding('utf8');
                process.stdout.on('data', data => console.log(data));
                process.stderr.on('data', data => console.log(data));
                process.on('error', error => reject(error));
                process.on('close', exitCode => { console.log('[Tester] Finished'); resolve(exitCode); });
            });
        }
    }
}).parse();
