import TestsConfig from './tests.config.js';

import FileCustodianLib from '../lib';
import FileCustodianBuild from '../build';
const FileCustodian = TestsConfig.sourcePath == "../lib" ? FileCustodianLib : FileCustodianBuild;

const timeout = TestsConfig.testTimeout;

test('protector.creation', async () => {
    const custodian = new FileCustodian(TestsConfig.custodian);
    await custodian.newDepository(TestsConfig.localDepository);
    await custodian.depository(TestsConfig.localDepository.name).init();

    const response = await custodian.depository(TestsConfig.localDepository.name).newProtector(TestsConfig.protector);
    expect(response).toBe(true);
}, timeout);
