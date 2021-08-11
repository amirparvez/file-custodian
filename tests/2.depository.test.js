import TestsConfig from './tests.config.js';

import FileCustodianLib from '../lib';
import FileCustodianBuild from '../build';
const FileCustodian = TestsConfig.sourcePath == "../lib" ? FileCustodianLib : FileCustodianBuild;

const timeout = TestsConfig.testTimeout;

test('depository.creation', async () => {
    const custodian = new FileCustodian(TestsConfig.custodian);

    const response = await custodian.newDepository(TestsConfig.localDepository);
    expect(response).toBe(true);
}, timeout);


test('depository.initialization', async () => {
    const custodian = new FileCustodian(TestsConfig.custodian);
    await custodian.newDepository(TestsConfig.localDepository);

    const response = await custodian.depository(TestsConfig.localDepository.name).init();
    expect(response).toBe(true);
}, timeout);
