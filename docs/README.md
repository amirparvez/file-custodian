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
| email (STRING) | Email of mega account | mega:True | - | - |
| password (STRING) | Password of mega account | mega:True | - | - |
| type (STRING) | Type of the depository  | True | local-server, aws-s3, do-spaces, mega, bb-b2 | - |
| basePath (STRING) | Base/Root path of the depository | False | - | System/Bucket root |
| bucketName (STRING) | (Amazon S3/Backblaze B2) bucket/DO Space name | s3,do,bb:True | - | - |
| bucketRegion (STRING) | (Amazon S3/Backblaze B2) bucket/DO Space region | s3,do,bb:True | - | - |
| key (STRING) | Amazon S3 key/DO Spaces secret/Backblaze B2 application key | s3,do,bb:True | - | - |
| endpoint (STRING) | DO Spaces/Backblaze B2 endpoint | do,bb:True | - | - |
| keyId (STRING) | (Amazon S3/Backblaze B2) key id/DO Spaces key | s3,do,bb:True | - | - |
| readingSpeed (INTEGER) | Chunk size when reading, in bytes | False | - | 16384 |
| writingSpeed (INTEGER) | Chunk size when writing, in bytes | False | - | 16384 |
| encryptingSpeed (INTEGER) | Chunk size when encrypting & decrypting, in bytes | False | - | 16384 |
| isDefault (BOOLEAN) | Sets the depository as default for the custodian | True | - | - |

> WARNING: Paths must only have forward slashes and must never start or end with a slash.

> WARNING: File versioning is not supported yet, make sure to disable it from Amazon and Backblaze B2 for your bucket.

> WARNING: readingSpeed, writingSpeed & encryptingSpeed affect memory usage of the library.

> WARNING: Files can only be successfully decrypted at the same speed they were encrypted. Play with this value carefully.

> NOTE: Sometimes, lag has been noticed in reading files from MEGA. Source of this problem is unidentified yet.

> NOTE: You must create your Backblaze B2 bucket manually and it should be public.

> NOTE: If a Backblaze B2 Application Key is restricted to a bucket, the listAllBucketNames permission is required for compatibility with SDKs.

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

// DigitalOcean Spaces
const success = await custodian.newDepository({
    name: "do-1",
    type: "do-spaces",
    bucketName: "file-custodian",
    bucketRegion: "xx-xxxxx-x",
    key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyId: "xxxxxxxxxxxxxxxxxxxx",
    endpoint: "xxxx.digitaloceanspaces.com",
    isDefault: true,
});

// Mega
await custodian.newDepository({
    name: "m-1",
    type: "mega",
    email: "xxxxxxxxxxx@xxxxxx.xxx",
    password: "xxxxxxxxx",
    isDefault: true,
});

// Backblaze B2
await custodian.newDepository({
    name: "b2-1",
    type: "bb-b2",
    bucketName: "file-custodian",
    bucketRegion: "xx-xxxxx-x",
    key: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyId: "xxxxxxxxxxxxxxxxxxxx",
    endpoint: "xx.xx-xxxx-xxx.backblazeb2.com",
    isDefault: true,
});

await custodian.depository(depositoryName).init(); // Important
```
>Returns **true** or **false**.

<br>

### **Environment Variables**

```
FILECUSTODIAN_DEBUG=true
FILECUSTODIAN_PROTECTOR_KEY=YOUR_32_BYTE_KEY_IN_HEX_FORM_FOR_EN/DE-CRYPTION
```

<br>

Learn more from **Object Specific Documentations:**

- [Depository Documentation](https://github.com/muhammadamir-github/file-custodian/tree/main/docs/depository.md)
- [Database Documentation](https://github.com/muhammadamir-github/file-custodian/tree/main/docs/database.md)
- [File Documentation](https://github.com/muhammadamir-github/file-custodian/tree/main/docs/file.md)
