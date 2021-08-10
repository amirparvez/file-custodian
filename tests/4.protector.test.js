import FileCustodian from '../lib';
import TestsConfig from './tests.config.js';

const timeout = TestsConfig.testTimeout;

test('protector.creation', async () => {
    const custodian = new FileCustodian(TestsConfig.custodian);
    await custodian.newDepository(TestsConfig.localDepository);
    await custodian.depository(TestsConfig.localDepository.name).init();

    const response = await custodian.depository(TestsConfig.localDepository.name).newProtector(TestsConfig.protector);
    expect(response).toBe(true);
}, timeout);
