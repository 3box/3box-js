# 3box-js

**Warning:** This project is under active development, APIs are subject to change.

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.


## Installation
Install 3box in your npm project:
```
$ npm install 3box@next
```

## Usage
### Import 3Box into your project
Import the 3box module
```js
const ThreeBox = require('3box')
```
or use the dist build in your html code
```js
<script type="text/javascript" src="../dist/3box.js"></script>
```

### Get the public profile of an address
3Box allows users to create a public profile. In your dapp you might have multiple ethereum addresses that you would like to display a name and picture for. The `getProfile` method allows you to retrieve the profile of any ethereum address (if it has one). This is a *static* method so you can call it directly from the **ThreeBox** object.

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
To get or modify data in a user's 3Box, first open their 3Box by calling the openBox method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `web3provider` refers to the object that you would get from `web3.currentProvider`, or request directly from the web3 browser, e.g. MetaMask.

#### Open 3Box session
Using `async/await`
```js
const box = await ThreeBox.openBox('0x12345abcde', web3provider)
```
or using `.then`
```js
ThreeBox.openBox('0x12345abcde', web3provider).then(box => {
  // interact with 3Box data
})
```

#### Interact with 3Box data
You can now use the `box` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`. [**What keys can I use?**](./KEY-USAGE.md)

Using `async/await`
```js
// use the public profile
// get
const nickname = await box.profileStore.get('name')
console.log(nickname)
// set
await box.profileStore.set('name', 'oed')
// remove
await box.profileStore.remove('name')

// use the private store
// get
const email = await box.privateStore.get('email')
console.log(email)
// set
await box.privateStore.set('email', 'oed@email.service')
// remove
await box.privateStore.remove('email')
```
or using `.then`
```js
// use the public profile
// get
box.profileStore.get('name').then(nickname => {
  console.log(nickname)
  // set
  box.profileStore.set('name', 'oed').then(() => {
    // remove
    box.profileStore.remove('name').then(() => {
    })
  })
})

// use the private store
// get
box.privateStore.get('email').then(email => {
  console.log(email)
  // set
  box.privateStore.set('email', 'oed@email.service').then(() => {
    // remove
    box.privateStore.remove('email').then(() => {
    })
  })
})
```

# API Documentation

