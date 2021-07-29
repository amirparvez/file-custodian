# **Api Documentation**

#### **Creating a new custodian**

Each custodian can manage **multiple depositories**.

| Field | Description | Required |
| :--- |    :---   |  :---:   |
| name (STRING) | Unique name for the custodian | True |

```js
const FileCustodian = require("file-custodian");
const custodian = new FileCustodian({ name: "Boogeyman", });
```
>Returns new **custodian**.

#### **Creating a new depository**

Depository is where files are stored. Each depository can have one **protector** and **database handler**.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| name (STRING) | Unique name for the depository | True | - | - |
| type (STRING) | Type of the depository  | True | local-server, aws-s3 | - |
| base_path (STRING) | Base/Root path of the depository | False | - | System/Bucket root |
| bucket_name (STRING) | Amazon S3 bucket name | s3:True | - | - |
| bucket_region (STRING) | Amazon S3 bucket region | s3:True | - | - |
| key (STRING) | Amazon S3 key | s3:True | - | - |
| key_id (STRING) | Amazon S3 key id | s3:True | - | - |
| readingSpeed (INTEGER) | Chunk size when reading, in bytes | False | - | 16384 |
| writingSpeed (INTEGER) | Chunk size when writing, in bytes | False | - | 16384 |
| encryptingSpeed (INTEGER) | Chunk size when encrypting & decrypting, in bytes | False | - | 16384 |
| isDefault (BOOLEAN) | Sets the depository as default for the custodian | True | - | - |

> NOTE: readingSpeed, writingSpeed & encryptingSpeed affect memory usage of the library.

> WARNING: Files can only be successfully decrypted at the same speed they were encrypted. Play with this value carefully.

```js
// Local
const success = await custodian.newDepository({
    name: "ls-1",
    type: "local-server",
    base_path: "C:/depository",
    isDefault: true,
});

// Amazon S3
const success = await custodian.newDepository({
    name: "s3-1",
    type: "aws-s3",
    bucket_name: "file-custodian",
    bucket_region: "xx-xxxxx-x",
    key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    key_id: "xxxxxxxxxxxxxxxxxxxx",
    isDefault: true,
});
```
>Returns **true** or **false**.

#### **Creating a new database for depository**

Database is used to **store information** about the depository's files.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| host (STRING) | Database server host | True | - | - |
| port (STRING) | Database service port  | True | - | - |
| system (STRING) | Database system/type | True | mysql, mariadb, postgres | - |
| database (STRING) | Database name | True | - | - |
| username (STRING) | User name | True | - | - |
| password (STRING) | User password | True | - | - |
| table_name (STRING) | Files table name | False | - | fcfiles |
| proper_delete (BOOLEAN) | False for deleting the file only & True for deleting the information from the database also | False | - | false |
| sequelize_instance | Sequelize instance | False | - | - |
| user_model | Sequelize UserModel for establishing a relationship with FileModel | False | - | - |

> NOTE: host, port, system, database, username and password is not required when passing your own sequelize_instance.

```js
const success = await custodian.depository("s3-1").newDatabase({
    host: "localhost",
    port: "3306",
    system: "mariadb",
    database: "file-custodian",
    username: "xxxxx",
    password: "xxxxx",
    table_name: "xxxxx",
    proper_delete: false,
    sequelize_instance: sequelize,
    user_model: UserModel,
});
```
>Returns **true** or **false**.

#### **Creating a new protector for depository**

Protector is used to **encrypt** and **decrypt** depository's files.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| algorithm (STRING) | Encryption algorithm | False | aes-256-ctr | aes-256-ctr |

> NOTE: host, port, system, database, username and password is not required when passing your own sequelize_instance.

```js
const success = await custodian.depository("s3-1").newProtector({ algorithm: "aes-256-ctr" });
```
>Returns **true** or **false**.
