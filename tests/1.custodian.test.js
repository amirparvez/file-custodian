import TestsConfig from './tests.config.js';

import FileCustodianLib from '../lib';
import FileCustodianBuild from '../build';
const FileCustodian = TestsConfig.sourcePath == "../lib" ? FileCustodianLib : FileCustodianBuild;

const timeout = TestsConfig.testTimeout;

test('custodian.creation', () => {
    const custodian = new FileCustodian(TestsConfig.custodian);
    expect(custodian).toBeInstanceOf(FileCustodian);
}, timeout);
