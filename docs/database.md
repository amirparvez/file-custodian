# **Database Documentation**

Configuration:
```js
custodian.depository("s3-1").database().config

{
    system,
    host,
    port,
    database,
    userName,
    password,
    tableName,
    properDelete,
    sequelizeInstance,
    userModel,
}
```

<br>

### **Establishing a connection with the database**

This must be always done just after creating a new database.

```js
await custodian.depository("ls-1").database().connect();
```
>Returns true or false.

<br>

### **Creating a new table**

This will create a new table in the database.

> NOTE: If the table already exists it will be dropped and recreated.

```js
await custodian.depository("ls-1").database().createTable();
```
>Returns true or false.

<br>
