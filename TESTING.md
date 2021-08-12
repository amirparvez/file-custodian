# **Testing**

> WARNING: Before testing, make sure ENV in .env file is set to 'dev' and for building it should be set to 'prod'.

You can use **tester.js** to test modules. All tests are available in **tests** folder. Make sure to configure the library for testing in **tests.config.js** file also present in the tests folder.

Before running any tests, you must build the library even if you are not testing the build version. You can control which version to test by pointing sourcePath in tests.config.js to it's folder.

```js
{
    ...sourcePath: "../lib", // To test build, use ../build.
}
```

</br>

Command for building:
```
npm run build
```

</br>

Command for running tests:
```
node tester.js run -n <test-name> -d
```

> NOTE: -d is for debug.

> WARNING: Make sure you have installed npx and all dev dependencies on your machine.

> WARNING: Depository tests are done in 'tests' folder. Make sure it is empty.

| Test Name | Description |
| :--- |    :---   |
| all | Tests for the entire library |
| custodian | Tests for custodian |
| depository | Tests for depository |
| database | Tests for database |
| local | Tests for local-server |
| s3 | Tests for amazon s3 |
| b2 | Tests for backblaze b2 |
| spaces | Tests for digitalocean spaces |
| mega | Tests for mega.nz |
