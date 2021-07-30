# **Api Documentation**

### **Creating a new custodian**

Each custodian can manage **multiple depositories**.

| Field | Description | Required |
| :--- |    :---   |  :---:   |
| name (STRING) | Unique name for the custodian | True |

```js
const FileCustodian = require("file-custodian");
const custodian = new FileCustodian({ name: "Boogeyman", });
```
>Returns new **custodian**.

<br>

### **Creating a new depository**

Depository is where files are stored. Each depository can have one **protector** and **database handler**.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| name (STRING) | Unique name for the depository | True | - | - |
| type (STRING) | Type of the depository  | True | local-server, aws-s3 | - |
| basePath (STRING) | Base/Root path of the depository | False | - | System/Bucket root |
| bucketName (STRING) | Amazon S3 bucket name | s3:True | - | - |
| bucketRegion (STRING) | Amazon S3 bucket region | s3:True | - | - |
| key (STRING) | Amazon S3 key | s3:True | - | - |
| keyId (STRING) | Amazon S3 key id | s3:True | - | - |
| readingSpeed (INTEGER) | Chunk size when reading, in bytes | False | - | 16384 |
| writingSpeed (INTEGER) | Chunk size when writing, in bytes | False | - | 16384 |
| encryptingSpeed (INTEGER) | Chunk size when encrypting & decrypting, in bytes | False | - | 16384 |
| isDefault (BOOLEAN) | Sets the depository as default for the custodian | True | - | - |

> NOTE: readingSpeed, writingSpeed & encryptingSpeed affect memory usage of the library.

> WARNING: Files can only be successfully decrypted at the same speed they were encrypted. Play with this value carefully.

> WARNING: Paths must never start or end with a slash.

```js
// Local
const success = await custodian.newDepository({
    name: "ls-1",
    type: "local-server",
    basePath: "C:/depository",
    isDefault: true,
});

// Amazon S3
const success = await custodian.newDepository({
    name: "s3-1",
    type: "aws-s3",
    bucketName: "file-custodian",
    bucketRegion: "xx-xxxxx-x",
    key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyId: "xxxxxxxxxxxxxxxxxxxx",
    isDefault: true,
});
```
>Returns **true** or **false**.

<br>

Learn more from **Object Specific Documentations:**

- [Depository Documentation](https://github.com/amirparvez/file-custodian/tree/main/docs/depository.md)
- [Database Documentation](https://github.com/amirparvez/file-custodian/tree/main/docs/database.md)
- [File Documentation](https://github.com/amirparvez/file-custodian/tree/main/docs/file.md)
