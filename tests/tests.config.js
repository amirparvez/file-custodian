export default {
    sourcePath: "../lib", // To test build, use ../build.
    testTimeout: 60000,
    dbForDepositoryTesting: "sql", // Which database to use when testing depositories. // nosql for mongodb.
    custodian: {
        name: "Test"
    },
    localDepository: {
        name: "ls-1",
        type: "local-server",
        basePath: "C:/depository",
        isDefault: true
    },
    s3Depository: {
        name: "s3-1",
        type: "aws-s3",
        bucketName: "file-custodian",
        bucketRegion: "xx-xxxxx-x",
        key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        keyId: "xxxxxxxxxxxxxxxxxxxx",
        isDefault: true
    },
    b2Depository: {
        name: "b2-1",
        type: "bb-b2",
        bucketName: "file-custodian",
        bucketRegion: "xx-xxxxx-x",
        key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        keyId: "xxxxxxxxxxxxxxxxxxxx",
        endpoint: "xx.xx-xxxx-xxx.backblazeb2.com",
        isDefault: true
    },
    spacesDepository: {
        name: "do-1",
        type: "do-spaces",
        bucketName: "file-custodian",
        bucketRegion: "xx-xxxxx-x",
        key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        keyId: "xxxxxxxxxxxxxxxxxxxx",
        endpoint: "xxxx.digitaloceanspaces.com",
        isDefault: true
    },
    megaDepository: {
        name: "m-1",
        type: "mega",
        email: "xxxxxxxxxxx@xxxxxx.xxx",
        password: "xxxxxxxxx",
        isDefault: true,
    },
    sqlDb: {
        host: "localhost",
        port: "3306",
        system: "mariadb",
        database: "xxxxx",
        userName: "xxxxx",
        password: "xxxxx",
        tableName: "test_fcfiles",
        properDelete: false
    },
    sqlDbCustomSequelize: {
        host: "localhost",
        port: "3306",
        system: "mariadb",
        database: "xxxxx",
        userName: "xxxxx",
        password: "xxxxx",
        tableName: "test_fcfiles_custom_sequelize",
        properDelete: false,
        customSequelizeOptions: { // Options of your custom sequelize instance.
            logging: false,
            timezone: "+00:00",
            dialectOptions: {
              connectTimeout: 90000,
              useUTC: true,
              timezone: "+00:00"
            }
        }
    },
    nosqlDb: {
        system: "mongodb",
        url: `mongodb+srv://${username}:${password}@xxxxxx.xxxxx.mongodb.net/${database}`,
        tableName: "test_fcfiles",
        properDelete: false,
    },
    protector: {
        algorithm: "aes-256-ctr"
    }
}
