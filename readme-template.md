[![CircleCI](https://img.shields.io/circleci/project/github/3box/3box-js/master.svg?style=for-the-badge)](https://circleci.com/gh/3box/3box-js)
[![Discord](https://img.shields.io/discord/484729862368526356.svg?style=for-the-badge)](https://discordapp.com/invite/Z3f3Cxy)
[![npm](https://img.shields.io/npm/dt/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![npm](https://img.shields.io/npm/v/3box.svg?style=for-the-badge)](https://www.npmjs.com/package/3box)
[![Codecov](https://img.shields.io/codecov/c/github/uport-project/3box-js.svg?style=for-the-badge)](https://codecov.io/gh/uport-project/3box-js)
[![Twitter Follow](https://img.shields.io/twitter/follow/3boxdb.svg?style=for-the-badge&label=Twitter)](https://twitter.com/3boxdb)

[Install](#install) | [Usage](#usage) | [Dapp data](#dappdata) | [Example](#example) | [API Docs](#api)

# 3box-js

This is a library which allows you to set, get, and remove private and public data associated with an ethereum account. It can be used to store identity data, user settings, etc. by dapps that use a web3 enabled browser. The data will be retrievable as long as the user has access to the private key for the used ethereum account. The data is encrypted and can not be read by any third party that the user hasn't authorized. Currently it supports one shared space which all dapps can access. In the future there will be support for more granular access control using namespaces.

## <a name="install"></a>Installation
Install 3box in your npm project:
```
$ npm install 3box
```

## <a name="usage"></a>Usage
### Import 3Box into your project
Import the 3box module
```js
const Box = require('3box')
```
Import using the dist build in your html code
```js
<script type="text/javascript" src="../dist/3box.js"></script>
```

Or optionally by loading remote copy from [unpkg](https://unpkg.com/) CDN.

```html
<!-- The most recent version  -->
<script src="https://unpkg.com/3box/dist/3box.js"></script>
<!-- The most recent minified version  -->
<script src="https://unpkg.com/3box/dist/3box.min.js"></script>
<!-- Load specific versions by specifying the version as follows -->
<script src="https://unpkg.com/3box@<version>/dist/3box.js"></script>
```

### Get the public profile of an address
3Box allows users to create a public profile. In your dapp you might have multiple ethereum addresses that you would like to display a name and picture for. The `getProfile` method allows you to retrieve the profile of any ethereum address (if it has one). This is a *static* method so you can call it directly from the **Box** object.

Using `async/await`
```js
const profile = await Box.getProfile('0x12345abcde')
console.log(profile)
```
or using `.then`
```js
Box.getProfile('0x12345abcde').then(profile => {
  console.log(profile)
})
```

### Get, set, and remove data
To get or modify data in a user's 3Box, first open their 3Box by calling the openBox method. This method prompts the user to authenticate your dapp and returns a promise with a threeBox instance. You can only set, get, and remove data of users that are currently interacting with your dapp. Below `ethereumProvider` refers to the object that you would get from `web3.currentProvider`, or `window.ethereum`.

#### Open 3Box session
Using `async/await`
```js
const box = await Box.openBox('0x12345abcde', ethereumProvider)
```
or using `.then`
```js
Box.openBox('0x12345abcde', ethereumProvider).then(box => {
  // interact with 3Box data
})
```

#### Network sync
When you first open the box in your dapp all data might not be synced from the network yet. You should therefore add a listener using the `onSyncDone` method. This will allow you to know when all the users data is available to you. We advice against *setting* any data before this has happened.
```js
box.onSyncDone(yourCallbackFunction)
```


#### Interact with 3Box data
You can now use the `box` instance object to interact with data in the users private store and profile. In both the profile and the private store you use a `key` to set a `value`.

Using `async/await`
```js
// use the public profile
// get
const nickname = await box.public.get('name')
console.log(nickname)
// set
await box.public.set('name', 'oed')
// remove
await box.public.remove('name')

// use the private store
// get
const email = await box.private.get('email')
console.log(email)
// set
await box.private.set('email', 'oed@email.service')
// remove
await box.private.remove('email')
```
or using `.then`
```js
// use the public profile
// get
box.public.get('name').then(nickname => {
  console.log(nickname)
  // set
  box.public.set('name', 'oed').then(() => {
    // remove
    box.public.remove('name').then(() => {
    })
  })
})

// use the private store
// get
box.private.get('email').then(email => {
  console.log(email)
  // set
  box.private.set('email', 'oed@email.service').then(() => {
    // remove
    box.private.remove('email').then(() => {
    })
  })
})
```

## <a name="dappdata"></a> Dapp data
Dapps can store data about users that relate to only their dapp. However we encurage dapps to share data between them for a richer web3 experience. Therefore we have created [**Key Conventions**](./KEY-CONVENTIONS.md) in order to facilitate this. Feel free to make a PR to this file to explain to the community how you use 3Box!

## <a name="example"></a> Example

You can quickly run and interact with some code by looking at the files in the `/example` folder. You run the example with the following command:

```bash
$ npm run example:start
```

This runs a simple server at `http://localhost:3000/` that serves the static `example/index.html` file. This allows it easily interact with metamask. You can edit the `example/index.html` file to try differnt code.

## <a name="api"></a> API Documentation
