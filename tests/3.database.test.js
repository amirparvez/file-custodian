import { Sequelize } from '../node_modules/sequelize';
import TestsConfig from './tests.config.js';

import FileCustodianLib from '../lib';
import FileCustodianBuild from '../build';
const FileCustodian = TestsConfig.sourcePath == "../lib" ? FileCustodianLib : FileCustodianBuild;

const timeout = TestsConfig.testTimeout;

describe('database[mariadb]', () => {
    const custodian = new FileCustodian(TestsConfig.custodian);

    test('database[mariadb].creation', async () => {
        await custodian.newDepository(TestsConfig.localDepository);
        await custodian.depository(TestsConfig.localDepository.name).init();

        const resposne = await custodian.depository(TestsConfig.localDepository.name).newDatabase(TestsConfig.sqlDb);
        expect(resposne).toBe(true);
    }, timeout);

    let connectionResponse = false;
    test('database[mariadb].connection', async () => {
        connectionResponse = await custodian.depository(TestsConfig.localDepository.name).database().connect();
        expect(connectionResponse).toBe(true);
    }, timeout);

    test('database[mariadb].table.creation', async () => {
        const response = await custodian.depository(TestsConfig.localDepository.name).database().createTable();
        expect(response).toBe(true);
    }, timeout);

    test('database[mariadb].disconnection', async () => {
        let response = false;
        if(connectionResponse === true){
            // Only for testing
            try{
                await custodian.depository(TestsConfig.localDepository.name).database().sequelize.close();
                response = true;
            }catch(error){ console.log("[TEST-LOG] ", error); }
        }else{ response = true; }

        expect(response).toBe(true);
    }, timeout);
});

describe('database[mariadb][custom-sequelize]', () => {
    const sequelize = new Sequelize(TestsConfig.sqlDbCustomSequelize.database, TestsConfig.sqlDbCustomSequelize.userName, TestsConfig.sqlDbCustomSequelize.password,
        {
            host: TestsConfig.sqlDbCustomSequelize.host,
            port: TestsConfig.sqlDbCustomSequelize.port,
            dialect: TestsConfig.sqlDbCustomSequelize.system,
            ...TestsConfig.sqlDbCustomSequelize.customSequelizeOptions,
        }
    );

    const custodian = new FileCustodian(TestsConfig.custodian);

    test('database[mariadb][custom-sequelize].creation', async () => {
        await custodian.newDepository(TestsConfig.localDepository);
        await custodian.depository(TestsConfig.localDepository.name).init();

        const resposne = await custodian.depository(TestsConfig.localDepository.name).newDatabase({
            tableName: TestsConfig.sqlDbCustomSequelize.tableName,
            properDelete: TestsConfig.sqlDbCustomSequelize.properDelete,
            system: TestsConfig.sqlDbCustomSequelize.system,
            sequelizeInstance: sequelize
        });
        expect(resposne).toBe(true);
    }, timeout);

    let connectionResponse = false;
    test('database[mariadb][custom-sequelize].connection', async () => {
        connectionResponse = await custodian.depository(TestsConfig.localDepository.name).database().connect();
        expect(connectionResponse).toBe(true);
    }, timeout);

    test('database[mariadb][custom-sequelize].table.creation', async () => {
        const response = await custodian.depository(TestsConfig.localDepository.name).database().createTable();
        expect(response).toBe(true);
    }, timeout);

    test('database[mariadb][custom-sequelize].disconnection', async () => {
        let response = false;
        if(connectionResponse === true){
            // Only for testing
            try{
                await custodian.depository(TestsConfig.localDepository.name).database().sequelize.close();
                response = true;
            }catch(error){ console.log("[TEST-LOG] ", error); }
        }else{ response = true; }

        expect(response).toBe(true);
    }, timeout);
});

describe('database[mongodb]', () => {
    const custodian = new FileCustodian(TestsConfig.custodian);

    test('database[mongodb].creation', async () => {
        await custodian.newDepository(TestsConfig.localDepository);
        await custodian.depository(TestsConfig.localDepository.name).init();

        const resposne = await custodian.depository(TestsConfig.localDepository.name).newDatabase(TestsConfig.nosqlDb);
        expect(resposne).toBe(true);
    }, timeout);

    let connectionResponse = false;
    test('database[mongodb].connection', async () => {
        connectionResponse = await custodian.depository(TestsConfig.localDepository.name).database().connect();
        expect(connectionResponse).toBe(true);
    }, timeout);

    test('database[mongodb].table.creation', async () => {
        const response = await custodian.depository(TestsConfig.localDepository.name).database().createTable();
        expect(response).toBe(true);
    }, timeout);

    test('database[mongodb].disconnection', async () => {
        let response = false;
        if(connectionResponse === true){
            // Only for testing
            try{
                await custodian.depository(TestsConfig.localDepository.name).database().mongoose.connection.close();
                response = true;
            }catch(error){ console.log("[TEST-LOG] ", error); }
        }else{ response = true; }

        expect(response).toBe(true);
    }, timeout);
});
