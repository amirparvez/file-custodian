# **Depository Documentation**

Configuration:
```js
custodian.depository(depositoryName).config

{
    type,
    basePath,
    userId,
    readingSpeed,
    writingSpeed,
    encryptingSpeed,

    // S3/DO Spaces
    bucketName,
    bucketRegion,
    keyId,
    key,
    s3, // S3 Object

    // Mega
    email,
    password,
    mega, // Mega Object
    spaceAvailable,
}

```
<br>

### **Initialization**

This will setup the depository.

> NOTE: This must always be done.

```js
await custodian.depository("ls-1").init();
```
>Returns true or false.

<br>

> NOTE: **You can call all functions of the default depository without specifying it's name**.

```js
custodian.getFile(...); // Default depository
custodian.depository(depositoryName).getFile(...); // Specific depository
```

<br>

### **Creating a new database for depository**

Database is used to **store information** about the depository's files.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| host (STRING) | Database server host | True | - | - |
| port (STRING) | Database service port  | True | - | - |
| system (STRING) | Database system/type | True | mysql, mariadb, postgres | - |
| database (STRING) | Database name | True | - | - |
| userName (STRING) | User name | True | - | - |
| password (STRING) | User password | True | - | - |
| tableName (STRING) | Files table name | False | - | fcfiles |
| properDelete (BOOLEAN) | False for deleting the file only & True for deleting the information from the database also | False | - | false |
| sequelizeInstance | Sequelize instance | False | - | - |
| userModel | Sequelize User Model for establishing a relationship with File Model | False | - | - |
| url | MongoDB url | mongodb:True | - | - |

> NOTE: You can only provide userModel and sequelizeInstance when NOT using mongodb.

> NOTE: host, port, database, userName and password is not required when providing your own sequelize instance OR when using mongodb.

```js
const success = await custodian.depository("s3-1").newDatabase({
    host: "localhost",
    port: "3306",
    system: "mariadb",
    database: "xxxxx",
    userName: "xxxxx",
    password: "xxxxx",
    tableName: "xxxxx",
    properDelete: false,
    userModel: UserModel,
});

// Custom sequelize instance
const success = await custodian.depository("s3-1").newDatabase({
    system: "mariadb",
    tableName: "xxxxx",
    properDelete: false,
    sequelizeInstance: sequelize,
    userModel: UserModel,
});

// MongoDB
const success = await custodian.depository("s3-1").newDatabase({
    system: "mongodb",
    url: `mongodb+srv://${username}:${password}@xxxxxx.xxxxx.mongodb.net/${database}`,
    tableName: "xxxxx",
    properDelete: false,
});

await custodian.depository("s3-1").database().connect();
await custodian.depository("s3-1").database().createTable(); // Invalid when using mongodb
```
>Returns **true** or **false**.

Learn more from [Database Documentation](https://github.com/amirparvez/file-custodian/tree/main/docs/database.md)

<br>

### **Syncing database with depository**

This will create an entry for each file in the database if it does not exists.

> WARNING: Syncing database and depository will result in encryption of files whose entry does not exists in the database if a protector is connected, since it will not be possible to know whether a file is already encrypted or not. To ignore this behaviour, disconnect the protector when syncing.

```js
const files = await custodian.depository("s3-1").syncDatabase();
```
>Returns files or [ ].

<br>

### **Creating a new protector for depository**

Protector is used to **encrypt** and **decrypt** depository's files.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| algorithm (STRING) | Encryption algorithm | False | aes-256-ctr | aes-256-ctr |

> NOTE: You have to add your own 32 byte key in hex form, to the config.json file. If you leave it null or empty then protector will generate one itself. Make sure to keep that safe.

```js
{
    "debug": true,
    "file_protector_key": "YOURKEY" // null or ""
}
```

> NOTE: Protector uses a unique initialization vector for each file, which is stored in the file itself.

```js
const success = await custodian.depository("s3-1").newProtector({ algorithm: "aes-256-ctr" });
```
>Returns **true** or **false**.

<br>

### **Updating the current user**

This will set the current user id for the depository.

| Parameter | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| userId (INTEGER) | Current user id | False | - | - |

> NOTE: This functionality is only available if a User Model was provided for relating it to the File Model when creating the depository.

> NOTE: This must be used carefully. If the user id is not set to null, all file queries will be made on behalf of the user.

```js
custodian.depository("ls-1").user(1); // User specfic database queries
custodian.depository("ls-1").user(null); // Ignore user
```
>Returns depository or null.

<br>

### **Creating a new file**

This will save a new file in the depository.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| name (STRING) | Name for the file | True | - | - |
| ext (STRING) | Extension for the file, without dot | True | - | - |
| folder (STRING) | Folder to save the file in | False | FILE_EXTENSION_WISE | Depository root |
| contents (STRING, STREAM) | Contents of the file | True | - | - |
| isEncrypted (BOOLEAN) | When true, ignore encryption | False | - | false |
| isStream (BOOLEAN) | When true, treat contents as a STREAM | False | - | false |
| contentLength (INTEGER) | Length of contents, REQUIRED when providing a stream | - | - | - |
| request (HTTP REQUEST) | HTTP multipart/form-data request containing files | False | - | - |

> WARNING: Paths must never start or end with a slash.

> NOTE: name, ext and contents is not required when providing an HTTP request.

> NOTE: Adding FILE_EXTENSION_WISE to folder path will save the file/s in folder/s named to their extension/s.

```js
const newFile = await custodian.depository("s3-1").newFile({
    name: "file",
    ext: "txt",
    contents: "Hello!",
    folder: "testing"
});

// With stream
const newFile = await custodian.depository("s3-1").newFile({
    name: "file",
    ext: "txt",
    contents: fs.createReadStream(filepath),
    folder: "testing/stream",
    isStream: true,
    contentLength: 278192
});

// With HTTP request
app.post("/upload", async function(request, response){
    const files = await custodian.depository("s3-1").newFile({ request }).then(files => {
        return files;
    }).catch(error => {
        return [];
    });

    response.end("uploaded");
});

// FILE_EXTENSION_WISE example
app.post("/upload", async function(request, response){
    const files = await custodian.depository("s3-1").newFile({
        request,
        folder: "images/FILE_EXTENSION_WISE"
    }).then(files => {
        return files;
    }).catch(error => {
        return [];
    });

    response.end("uploaded");
});
```
>Returns file/[files] or null.

<br>

### **Fetching a file**

This will get a file from the depository.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| name (STRING) | Name for the file | True | - | - |
| ext (STRING) | Extension for the file, without dot | True | - | - |
| folder (STRING) | Folder to get the file from | False | - | Depository root |
| path (STRING) | Path of the file | False | - | - |

> WARNING: Paths must never start or end with a slash.

> NOTE: name, ext, and folder is not required when providing the path.

```js
const file = await custodian.depository("s3-1").getFile({
    name: "file",
    ext: "txt",
    folder: "testing"
});

// With path
const file = await custodian.depository("s3-1").getFile({ path: "testing/file.txt" });
```
>Returns file or null.

<br>

### **Searching files**

This will search files in the depository.

| Field | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| folder (STRING) | Folder to search the files in, provide * to search all folders | False | * | Depository root |
| query (STRING) | Search query | False | EXTENSION:XYZ, NAME:XYZ, NAME_CONTAINS:XYZ | null |
| forceRequestToS3 (BOOLEAN) | When true, make request to S3 instead of searching in the database | False | - | false |

> WARNING: Paths must never start or end with a slash.

> WARNING: Forcing a request to s3 might affect your s3 costs.

> NOTE: forceRequestToS3 is only applicable to S3 depositories.

> NOTE: null query will get all files in the folder.

```js
const pngFiles = await custodian.depository("s3-1").searchFiles({
    folder: "*",
    forceRequestToS3: true,
    query: "EXTENSION:PNG",
});

const mangoImages = await custodian.depository("s3-1").searchFiles({
    folder: "images/fruits",
    query: "NAME_CONTAINS:MANGO",
});

const tempFile = await custodian.depository("s3-1").searchFiles({
    folder: "*",
    query: "NAME:TEMP",
});

const allRootFolderFiles = await custodian.depository("s3-1").searchFiles({ });
const allDepositoryFiles = await custodian.depository("s3-1").searchFiles({ folder: "*" });
```
>Returns [files] or [ ].

Learn more from [File Documentation](https://github.com/amirparvez/file-custodian/tree/main/docs/file.md)

<br>
