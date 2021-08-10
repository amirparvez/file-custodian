import FileCustodian from '../lib';
import TestsConfig from './tests.config.js';

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
