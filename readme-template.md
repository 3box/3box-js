# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

[Data Schema](./DATA-MODEL.md)

[API Documentation](./API-SPECIFICATION.md)

## Usage
Simply install using npm
```
$ npm install 3box
```
and then import into your project
```js
const ThreeBox = require('3box')

ThreeBox.openBox(web3.eth.accounts[0]).then(threeBox => {
  // Code goes here...
})
```

