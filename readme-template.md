# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

[Data Schema](./DATA-MODEL.md)

## Installation
Install 3box in your npm project:
```
$ npm install 3box
```

## Usage
Import the 3box module
```js
const ThreeBox = require('3box')
```
or use the dist build in your html code
```js
<script type="text/javascript" src="../dist/3box.js"></script>
```

### Get the public profile of an address
Using `async/await`
```js
const profile = await ThreeBox.getProfile('0x12345abcde')
console.log(profile)
```
or using `.then`
```js
ThreeBox.getProfile('0x12345abcde').then(profile => {
  console.log(profile)
})
```

### Get, set, and remove data
To get private data, or modify public or private data in a users 3box you first have to open it by calling the `openBox` method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `web3provider` refers to the object that you would get from `web3.currentProvider`, or request directly from the web3 browser, e.g. MetaMask.

Using `async/await`
```js
const threeBox = await ThreeBox.openBox('0x12345abcde', web3provider)
```
or using `.then`
```js
ThreeBox.openBox('0x12345abcde', web3provider).then(threeBox => {
  // use the threeBox instance
})
```

You can now use the `threeBox` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`. [What keys can I use?](./KEY-USAGE.md)
Using `async/await`
```js
// use the public profile
// get
const nickname = await threeBox.profileStore.get('name')
console.log(nickname)
// set
await threeBox.profileStore.set('name', 'oed')
// remove
await threeBox.profileStore.remove('name')

// use the private store
// get
const email = await threeBox.profileStore.get('email')
console.log(email)
// set
await threeBox.profileStore.set('email', 'oed@email.service')
// remove
await threeBox.profileStore.remove('email')
```
or using `.then`
```js
// use the public profile
// get
threeBox.profileStore.get('name').then(nickname => {
  console.log(nickname)
  // set
  threeBox.profileStore.set('name', 'oed').then(() => {
    // remove
    threeBox.profileStore.remove('name').then(() => {
    })
  })
})

// use the private store
// get
threeBox.profileStore.get('email').then(email => {
  console.log(email)
  // set
  threeBox.profileStore.set('email', 'oed@email.service').then(() => {
    // remove
    threeBox.profileStore.remove('email').then(() => {
    })
  })
})
```

# API Documentation

