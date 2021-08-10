import FileCustodian from '../lib';
import TestsConfig from './tests.config.js';

const timeout = TestsConfig.testTimeout;

test('custodian.creation', () => {
    const custodian = new FileCustodian(TestsConfig.custodian);
    expect(custodian).toBeInstanceOf(FileCustodian);
}, timeout);
