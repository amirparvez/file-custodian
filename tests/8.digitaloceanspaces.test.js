import TestsConfig from './tests.config.js';

import FileCustodianLib from '../lib';
import FileCustodianBuild from '../build';
const FileCustodian = TestsConfig.sourcePath == "../lib" ? FileCustodianLib : FileCustodianBuild;

import FCFileLib from '../lib/assets/file.js';
import FCFileBuild from '../build/assets/file.js';
const FCFile = TestsConfig.sourcePath == "../lib" ? FCFileLib : FCFileBuild;

const timeout = TestsConfig.testTimeout;

describe('digitaloceanspaces', () => {
    const custodian = new FileCustodian(TestsConfig.custodian);

    test('digitaloceanspaces.depository.creation', async () => {
        await custodian.newDepository(TestsConfig.spacesDepository);

        const response = await custodian.depository(TestsConfig.spacesDepository.name).init();
        expect(response).toBe(true);
    }, timeout);

    let databaseConnectionResponse = false;
    describe('digitaloceanspaces.depository.database', () => {
        test('digitaloceanspaces.depository.database.creation', async () => {
            const response = await custodian.depository(TestsConfig.spacesDepository.name).newDatabase(TestsConfig.dbForDepositoryTesting.toString().trim() == "sql" ? TestsConfig.sqlDb : TestsConfig.nosqlDb);
            expect(response).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.database.connection', async () => {
            databaseConnectionResponse = await custodian.depository(TestsConfig.spacesDepository.name).database().connect();
            expect(databaseConnectionResponse).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.database.table.creation', async () => {
            const response = await custodian.depository(TestsConfig.spacesDepository.name).database().createTable();
            expect(response).toBe(true);
        }, timeout);
    });

    describe('digitaloceanspaces.depository.protector', () => {
        test('digitaloceanspaces.depository.protector.creation', async () => {
            const response = await custodian.depository(TestsConfig.spacesDepository.name).newProtector(TestsConfig.protector);
            expect(response).toBe(true);
        }, timeout);
    });

    describe('digitaloceanspaces.depository.file', () => {
        let file = null;
        let copiedFile = null;

        test('digitaloceanspaces.depository.file.new', async () => {
            file = await custodian.depository(TestsConfig.spacesDepository.name).newFile({ name: "testfile", ext: "txt", contents: "abcdefghijklmnopqrstuvwxyz", folder: "tests" });
            expect(file).toBeInstanceOf(FCFile);
        }, timeout);

        describe('digitaloceanspaces.depository.file.get', () => {
            test('digitaloceanspaces.depository.file.getByMeta', async () => {
                file = await custodian.depository(TestsConfig.spacesDepository.name).getFile({ name: "testfile", ext: "txt", folder: "tests" });
                expect(file).toBeInstanceOf(FCFile);
            }, timeout);

            test('digitaloceanspaces.depository.file.getByPath', async () => {
                file = await custodian.depository(TestsConfig.spacesDepository.name).getFile({ path: "tests/testfile.txt" });
                expect(file).toBeInstanceOf(FCFile);
            }, timeout);

            test('digitaloceanspaces.depository.file.getById', async () => {
                if(file){ file = await custodian.depository(TestsConfig.spacesDepository.name).getFile({ id: file.config.id }); }
                expect(file).toBeInstanceOf(FCFile);
            }, timeout);
        }, timeout);

        test('digitaloceanspaces.depository.file.record', async () => {
            const response = await file.record();
            expect(response).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.file.read', async () => {
            const { contents, contentType, contentLength, readStream } = await file.getContents();
            expect(contents).not.toBe(null);
            expect(readStream).not.toBe(null);
        }, timeout);

        test('digitaloceanspaces.depository.file.rename', async () => {
            const response = await file.rename("testfile_rename");
            expect(response).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.file.unprotect', async () => {
            const response = await file.unprotect();
            expect(response).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.file.protect', async () => {
            const response = await file.protect();
            expect(response).toBe(true);
        }, timeout);

        test('digitaloceanspaces.depository.file.search', async () => {
            const response = await custodian.depository(TestsConfig.spacesDepository.name).searchFiles({ folder: "tests", query: "NAME:testfile_rename", forceRequestToProvider: true })
            expect(response).toBeInstanceOf(Array);
            expect(response.length).toBe(1);
        }, timeout);

        test('digitaloceanspaces.depository.file.sync', async () => {
            const response = await custodian.depository(TestsConfig.spacesDepository.name).syncDatabase();
            expect(response).toBeInstanceOf(Array);
        }, timeout);

        test('digitaloceanspaces.depository.file.copy', async () => {
            copiedFile = await file.copyToFolder("tests/copies");
            expect(copiedFile).toBeInstanceOf(FCFile);
        }, timeout);

        test('digitaloceanspaces.depository.file.delete', async () => {
            const response1 = await file.delete();
            const response2 = await copiedFile.delete();
            expect(response1).toBe(true);
            expect(response2).toBe(true);
        }, timeout);
    });

    describe("digitaloceanspaces.depository.database", () => {
        test('digitaloceanspaces.depository.database.disconnection', async () => {
            let response = false;
            if(databaseConnectionResponse === true){
                // Only for testing
                try{
                    if(TestsConfig.dbForDepositoryTesting.toString().trim() == "sql"){
                        await custodian.depository(TestsConfig.spacesDepository.name).database().sequelize.close();
                        response = true;
                    }else{
                        await custodian.depository(TestsConfig.spacesDepository.name).database().mongoose.connection.close();
                        response = true;
                    }
                }catch(error){ console.log("[TEST-LOG] ", error); }
            }else{ response = true; }

            expect(response).toBe(true);
        }, timeout);
    });
});
