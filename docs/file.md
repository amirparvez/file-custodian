# **File Documentation**

Configuration:
```js
file.config

{
    id,
    name,
    ext,
    size,
    folder,
    path,
    isEncrypted,
    isDeleted,
    created_at,
    updated_at,
    deleted_at,
    userId,
    iv,
    handler, // Depository object
}

```

<br>

### **Recording a file's information in database**

This will create an entry in database for the file if it does not exists.

```js
const success = await file.record();
```
>Returns true or false.

<br>

### **Renaming a file**

This will rename the file and update the database if connected.

> WARNING: Behind the scenes the file is copied with the new name. Speed of renaming files depends on your storage provider.

| Parameter | Description | Required | Options | Default |
| :--- |    :---   |  :---:   | :---: | :---: |
| newName (STRING) | New name for the file, without extension | True | - | - |

```js
const success = await file.rename("newname");
```
>Returns true or false.

<br>

### **Deleting a file**

This will delete the file and update the database if connected.

```js
const success = await file.delete();
```
>Returns true or false.

<br>

### **Protecting a file**

This will encrypt the file and update the database if connected.

```js
const success = await file.protect();
```
>Returns true or false.

<br>

### **Unprotecting a file**

This will decrypt the file and update the database if connected.

```js
const success = await file.unprotect();
```
>Returns true or false.

<br>

### **Reading a file**

This will read the file.

```js
const { contents, contentType, contentLength, readStream } = await file.getContents();
```

> NOTE: contents can be a pipeline of streams which emits the final file data whereas readStream is merely a read stream. To get the contents of the file, listen for data events on the contents.

> NOTE: You will have to resume the readStream to start receiving the data.

> NOTE: This always returns the decrypted contents except when a protector is not created.

> NOTE: contents do not include the initialization vector used to encrypt the file but contentLength is greater by 34 which is the number of bytes used in the file for storing the iv if the file is encrypted, subtracting 34 from it will give you it's real length.

Example of returing a file as http response:

```js
app.get("/view/:path*", async function(request, response){
    var parsedPath = path.parse(request.params.path+request.params[0]);
    const file = await custodian.depository("s3-1").getFile({
        name: `${parsedPath.name}`,
        ext: `${parsedPath.ext.split(".")[1]}`,
        folder: `${parsedPath.dir}`,
    });

    if(file){
        const { contents, contentType, contentLength, readStream } = await file.getContents();
        if(contents){
            response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': contentLength-(file.config.isEncrypted === true ? 34 : 0), });

            readStream.resume();
            contents.on('data', (data) => { response.write(data); });
            contents.on('end', () => { response.end(); });
        }else{ response.end("Invalid contents."); }
    }else{ response.end("Not found."); }
});
```

>Returns:
```js
 {
     contents: PIPELINE/STREAM/null,
     contentType: contentType/null, // example: image/png
     contentLength: contentLength/0, // example: 891723
     readStream: STREAM/null
 }
```

<br>
